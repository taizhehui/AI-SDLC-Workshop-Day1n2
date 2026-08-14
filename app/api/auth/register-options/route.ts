import { NextResponse, type NextRequest } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { badRequest, conflict, readJsonBody, withErrorHandling } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { authOptionsSchema } from '@/lib/validation';
import { challengeStore, getRelyingParty } from '@/lib/webauthn';

/**
 * Step 1 of registration: issue a challenge.
 *
 * Two cases share this endpoint:
 *   - **New account** — the username must be free, checked before a challenge is generated so
 *     a taken username costs nothing.
 *   - **Additional device** — a signed-in user registering their phone after their laptop.
 *     Their own username is not a conflict; their existing credentials are sent as
 *     `excludeCredentials` so the same device cannot be enrolled twice.
 */
export async function POST(request: NextRequest) {
  return withErrorHandling('POST /api/auth/register-options', async () => {
    const parsed = authOptionsSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Username is required');
    }

    const { username } = parsed.data;
    const existingUser = userDB.findByUsername(username);
    const session = await getSession();
    const isAddingDevice =
      existingUser !== null && session !== null && session.userId === existingUser.id;

    if (existingUser && !isAddingDevice) {
      return conflict('Username already taken');
    }

    const { rpID, rpName } = getRelyingParty(request);
    const existingCredentials = isAddingDevice
      ? authenticatorDB.findByUserId(existingUser.id)
      : [];

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: username,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existingCredentials.map((authenticator) => ({
        id: authenticator.credential_id,
        transports: authenticatorDB.parseTransports(
          authenticator,
        ) as AuthenticatorTransportFuture[],
      })),
    });

    challengeStore.save('register', username, options.challenge);
    return NextResponse.json(options);
  });
}
