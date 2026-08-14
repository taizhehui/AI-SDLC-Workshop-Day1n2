'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banner } from '@/components/ui/Banner';
import { useWebAuthn } from '@/lib/hooks/useWebAuthn';

/**
 * Passwordless registration and login (PRP 11).
 *
 * There is no password field anywhere — a username plus the device's authenticator is the
 * whole flow. An already-authenticated visitor is redirected straight to `/`.
 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const { error, setError, busy, register, login } = useWebAuthn();

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          router.replace('/');
          return;
        }
      } catch {
        // Offline or server error — fall through and show the form.
      }
      setCheckingSession(false);
    };

    void check();
  }, [router]);

  const handle = async (action: (name: string) => Promise<boolean>) => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a username');
      return;
    }
    if (await action(trimmed)) {
      router.replace('/');
      router.refresh();
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-gray-500 dark:text-gray-400">Checking your session…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Todo App</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sign in with a passkey — no password needed.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handle(login);
            }}
            placeholder="your-username"
            autoComplete="username webauthn"
            data-testid="username-input"
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>

        {error && (
          <Banner tone="error" testId="auth-error">
            {error}
          </Banner>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handle(login)}
            disabled={busy !== null}
            data-testid="login-button"
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === 'login' ? 'Signing in…' : 'Login'}
          </button>
          <button
            type="button"
            onClick={() => void handle(register)}
            disabled={busy !== null}
            data-testid="register-button"
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {busy === 'register' ? 'Registering…' : 'Register'}
          </button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Registering creates an account secured by this device&apos;s biometrics or security key.
        </p>
      </div>
    </main>
  );
}
