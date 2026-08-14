import { NextResponse, type NextRequest } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { badRequest, notFound, readJsonBody, withErrorHandling } from '@/lib/api-response';
import { authenticatorDB, userDB } from '@/lib/db';
import { authOptionsSchema } from '@/lib/validation';
import { challengeStore, getRelyingParty } from '@/lib/webauthn';

/**
 * Step 1 of login: issue an assertion challenge listing every credential the user has
 * registered, so login succeeds from any of their devices.
 */
export async function POST(request: NextRequest) {
  return withErrorHandling('POST /api/auth/login-options', async () => {
    const parsed = authOptionsSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Username is required');
    }

    const { username } = parsed.data;
    const user = userDB.findByUsername(username);
    const authenticators = user ? authenticatorDB.findByUserId(user.id) : [];

    if (!user || authenticators.length === 0) {
      return notFound('No passkey registered for this username');
    }

    const { rpID } = getRelyingParty();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: authenticators.map((authenticator) => ({
        id: authenticator.credential_id,
        transports: authenticatorDB.parseTransports(
          authenticator,
        ) as AuthenticatorTransportFuture[],
      })),
    });

    challengeStore.save('login', username, options.challenge);
    return NextResponse.json(options);
  });
}
