'use client';

import { useCallback, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { ApiError, apiClient } from '../api-client';

/**
 * Drives the four-step register/login WebAuthn flows from the browser (PRP 11).
 *
 * Two failure modes are separated deliberately:
 *   - the user dismissing the biometric prompt is a cancellation, not an error — the typed
 *     username is left intact so they can simply retry;
 *   - a device without passkey support gets a plain-language message rather than a raw
 *     `NotSupportedError`.
 */
export function useWebAuthn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'register' | 'login' | null>(null);

  const run = useCallback(
    async (flow: 'register' | 'login', username: string): Promise<boolean> => {
      setError(null);
      setBusy(flow);

      try {
        if (flow === 'register') {
          const options = await apiClient.post<PublicKeyCredentialCreationOptionsJSON>(
            '/api/auth/register-options',
            { username },
          );
          const attestation = await startRegistration({ optionsJSON: options });
          await apiClient.post('/api/auth/register-verify', { username, response: attestation });
        } else {
          const options = await apiClient.post<PublicKeyCredentialRequestOptionsJSON>(
            '/api/auth/login-options',
            { username },
          );
          const assertion = await startAuthentication({ optionsJSON: options });
          await apiClient.post('/api/auth/login-verify', { username, response: assertion });
        }
        return true;
      } catch (err) {
        setError(toMessage(err, flow));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  return {
    error,
    setError,
    busy,
    register: (username: string) => run('register', username),
    login: (username: string) => run('login', username),
  };
}

function toMessage(error: unknown, flow: 'register' | 'login'): string {
  if (error instanceof ApiError) return error.message;

  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      return flow === 'register'
        ? 'Passkey setup was cancelled. You can try again.'
        : 'Passkey prompt was cancelled. You can try again.';
    }
    if (error.name === 'NotSupportedError' || error.name === 'AbortError') {
      return 'Your browser or device does not support passkeys.';
    }
    if (error.name === 'InvalidStateError') {
      return 'This device already has a passkey registered for that account.';
    }
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
