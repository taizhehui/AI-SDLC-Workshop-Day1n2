import { NextResponse, type NextRequest } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { badRequest, readJsonBody, withErrorHandling } from '@/lib/api-response';
import { createSession, getSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { authVerifySchema } from '@/lib/validation';
import { challengeStore, getRelyingParty } from '@/lib/webauthn';

/**
 * Step 2 of registration: verify the attestation, persist the user + authenticator, and
 * establish the session.
 *
 * The session cookie is set before responding, so the client's redirect to `/` cannot race
 * middleware and get bounced back to `/login`.
 */
export async function POST(request: NextRequest) {
  return withErrorHandling('POST /api/auth/register-verify', async () => {
    const parsed = authVerifySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest('Invalid registration response');
    }

    const { username, response } = parsed.data;

    const expectedChallenge = challengeStore.consume('register', username);
    if (!expectedChallenge) {
      return badRequest('Registration challenge expired. Please try again.');
    }

    const { rpID, origin } = getRelyingParty(request);
    const verification = await verifyRegistrationResponse({
      response: response as unknown as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
    }

    const { credential } = verification.registrationInfo;

    // An authenticated user adding a second device keeps their existing account; otherwise
    // this is a brand-new registration.
    const session = await getSession();
    const existingUser = session ? userDB.findById(session.userId) : null;

    if (!existingUser && userDB.findByUsername(username)) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const user = existingUser ?? userDB.create(username);

    if (!authenticatorDB.findByCredentialId(credential.id)) {
      authenticatorDB.create({
        user_id: user.id,
        credential_id: credential.id,
        credential_public_key: credential.publicKey,
        // Coalesce: counter can legitimately be undefined on a fresh credential.
        counter: credential.counter ?? 0,
        transports: credential.transports ?? null,
      });
    }

    await createSession(user);
    return NextResponse.json({ success: true, user });
  });
}
