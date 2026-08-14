import { NextResponse, type NextRequest } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { badRequest, readJsonBody, withErrorHandling } from '@/lib/api-response';
import { createSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { authVerifySchema } from '@/lib/validation';
import { challengeStore, getRelyingParty } from '@/lib/webauthn';

/**
 * Step 2 of login: verify the assertion and update the stored signature counter.
 *
 * `counter` is coalesced with `?? 0` at every read and write — a `undefined` slipping into
 * `verifyAuthenticationResponse` silently breaks verification (CLAUDE.md "Critical pitfall").
 */
export async function POST(request: NextRequest) {
  return withErrorHandling('POST /api/auth/login-verify', async () => {
    const parsed = authVerifySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest('Invalid authentication response');
    }

    const { username, response } = parsed.data;
    const assertion = response as unknown as AuthenticationResponseJSON;

    const authenticator = authenticatorDB.findByCredentialId(assertion.id);
    if (!authenticator) {
      return NextResponse.json({ error: 'Authenticator not recognized' }, { status: 401 });
    }

    const user = userDB.findById(authenticator.user_id);
    if (!user || user.username.toLowerCase() !== username.toLowerCase()) {
      return NextResponse.json({ error: 'Authenticator not recognized' }, { status: 401 });
    }

    const expectedChallenge = challengeStore.consume('login', username);
    if (!expectedChallenge) {
      return badRequest('Login challenge expired. Please try again.');
    }

    const { rpID, origin } = getRelyingParty();
    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: authenticator.credential_id,
        publicKey: new Uint8Array(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
    }

    authenticatorDB.updateCounter(
      authenticator.id,
      verification.authenticationInfo.newCounter ?? 0,
    );

    await createSession(user);
    return NextResponse.json({ success: true, user });
  });
}
