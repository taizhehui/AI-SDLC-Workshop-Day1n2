/**
 * WebAuthn Relying Party configuration and the short-lived challenge store (PRP 11).
 */

export interface RelyingPartyConfig {
  /** Bare hostname — no scheme, no port. Passkeys are bound to this value. */
  rpID: string;
  rpName: string;
  /** Full origin the browser will report, including scheme and any port. */
  origin: string;
}

/** Hosts where WebAuthn permits a plain-HTTP origin. */
const INSECURE_ORIGIN_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Reduce any host-ish string to the bare hostname WebAuthn expects as an RP ID.
 *
 * Tolerates the shapes people actually paste into a dashboard — `https://example.com/`,
 * `example.com:3000`, `[::1]:3000` — because a scheme or port left in the RP ID makes every
 * registration fail with a confusing browser-side error.
 */
function toHostname(value: string): string {
  let host = value.trim();

  // Drop a scheme prefix, then anything from the first path separator onward.
  host = host.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  host = host.split('/')[0];

  // IPv6 literals are bracketed (`[::1]:3000`), so only split after the closing bracket.
  if (host.startsWith('[')) {
    const close = host.indexOf(']');
    return close === -1 ? host : host.slice(0, close + 1);
  }
  return host.split(':')[0];
}

const isLocalHostname = (host: string): boolean =>
  INSECURE_ORIGIN_HOSTS.has(host) || host.endsWith('.localhost');

/**
 * The public host, discovered in priority order:
 *
 *   1. `RP_ID` — explicit configuration always wins.
 *   2. Platform-injected domain (`RAILWAY_PUBLIC_DOMAIN`, `VERCEL_PROJECT_PRODUCTION_URL`,
 *      `VERCEL_URL`), so a normal deploy needs no manual setup.
 *   3. The request's own `Host`/`X-Forwarded-Host` header.
 *   4. `localhost`, for local development.
 *
 * Falling back to `localhost` on a real domain is what produces the browser error
 * *"The RP ID \"localhost\" is invalid for this domain"* — steps 2 and 3 exist so that
 * cannot happen silently.
 */
function requestHostname(request?: Request): string | null {
  const forwarded = request?.headers.get('x-forwarded-host') ?? request?.headers.get('host');
  if (!forwarded) return null;
  const host = toHostname(forwarded.split(',')[0]);
  return host || null;
}

function resolveHost(request?: Request): string | null {
  const requestHost = requestHostname(request);
  const configured = process.env.RP_ID?.trim();

  if (configured) {
    const configuredHost = toHostname(configured);

    // A leftover `RP_ID=localhost` (copied from .env.example) on a real domain would make
    // every registration fail with 'The RP ID "localhost" is invalid for this domain'. The
    // served host is unambiguously the right answer there, so prefer it and say so loudly
    // rather than honouring configuration that cannot possibly work.
    if (isLocalHostname(configuredHost) && requestHost && !isLocalHostname(requestHost)) {
      console.warn(
        `RP_ID is set to "${configuredHost}" but this request was served from "${requestHost}". ` +
          `Using "${requestHost}" — update RP_ID and RP_ORIGIN to silence this warning.`,
      );
      return requestHost;
    }

    return configuredHost;
  }

  const platformDomain =
    process.env.RAILWAY_PUBLIC_DOMAIN?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (platformDomain) return toHostname(platformDomain);

  return requestHost;
}

/** The scheme the browser used, honouring the proxy header Railway and Vercel set. */
function resolveProtocol(request: Request | undefined, host: string): string {
  const explicit = request?.headers.get('x-forwarded-proto');
  if (explicit) return explicit.split(',')[0].trim();
  return INSECURE_ORIGIN_HOSTS.has(host) ? 'http' : 'https';
}

/**
 * RP settings for the current request.
 *
 * Pass the incoming `Request` wherever one is available — it lets the RP ID and origin be
 * derived from the actual domain being served, so the app works on a fresh deploy without
 * any environment configuration.
 *
 * `RP_ID` and `RP_ORIGIN` still override everything. Set them explicitly once the final
 * domain is known: passkeys are bound to the RP ID, so if the derived host ever changes,
 * every already-registered passkey stops working.
 */
export function getRelyingParty(request?: Request): RelyingPartyConfig {
  const rpID = resolveHost(request) ?? 'localhost';
  const rpName = process.env.RP_NAME?.trim() || 'Todo App';

  const configuredOrigin = process.env.RP_ORIGIN?.trim();
  if (configuredOrigin) {
    // Same guard as the RP ID: a stale localhost origin cannot match what the browser
    // reports on a public domain, so it is discarded rather than failing every verification.
    const originHost = toHostname(configuredOrigin);
    if (!(isLocalHostname(originHost) && !isLocalHostname(rpID))) {
      return { rpID, rpName, origin: configuredOrigin.replace(/\/$/, '') };
    }
    console.warn(
      `RP_ORIGIN "${configuredOrigin}" does not match the served host "${rpID}" — deriving it instead.`,
    );
  }

  // Preserve the port for local development (`http://localhost:3000`); deployed hosts are
  // served on the default port, so the bare hostname is the whole authority.
  const rawHost =
    request?.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    request?.headers.get('host')?.trim() ??
    (rpID === 'localhost' ? 'localhost:3000' : rpID);

  return { rpID, rpName, origin: `${resolveProtocol(request, rpID)}://${rawHost}` };
}

/** Challenges expire quickly — a stale one must never be replayable. */
export const CHALLENGE_TTL_MS = 5 * 60_000;

interface StoredChallenge {
  challenge: string;
  expiresAt: number;
}

/**
 * In-memory, single-use challenge store keyed by `<flow>:<username>`.
 *
 * Held on `globalThis` so Next.js dev-mode module reloads do not drop challenges mid-flow.
 * This is process-local by design: a multi-instance deployment needs a shared store
 * (Redis or a database table) instead — see DEPLOYMENT.md "Single instance only".
 */
const globalForChallenges = globalThis as typeof globalThis & {
  __webauthnChallenges?: Map<string, StoredChallenge>;
};

function store(): Map<string, StoredChallenge> {
  if (!globalForChallenges.__webauthnChallenges) {
    globalForChallenges.__webauthnChallenges = new Map();
  }
  return globalForChallenges.__webauthnChallenges;
}

export type ChallengeFlow = 'register' | 'login';

const keyFor = (flow: ChallengeFlow, username: string): string =>
  `${flow}:${username.toLowerCase()}`;

function pruneExpired(now: number): void {
  for (const [key, entry] of store()) {
    if (entry.expiresAt <= now) store().delete(key);
  }
}

export const challengeStore = {
  save(flow: ChallengeFlow, username: string, challenge: string): void {
    const now = Date.now();
    pruneExpired(now);
    store().set(keyFor(flow, username), { challenge, expiresAt: now + CHALLENGE_TTL_MS });
  },

  /**
   * Read and immediately delete the challenge — single use. Returns `null` when absent,
   * already consumed, or expired.
   */
  consume(flow: ChallengeFlow, username: string): string | null {
    const key = keyFor(flow, username);
    const entry = store().get(key);
    if (!entry) return null;

    store().delete(key);
    if (entry.expiresAt <= Date.now()) return null;
    return entry.challenge;
  },

  clear(): void {
    store().clear();
  },
};
