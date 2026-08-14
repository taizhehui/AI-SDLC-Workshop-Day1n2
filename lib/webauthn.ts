/**
 * WebAuthn Relying Party configuration and the short-lived challenge store (PRP 11).
 */

export interface RelyingPartyConfig {
  rpID: string;
  rpName: string;
  origin: string;
}

/**
 * RP settings from the environment, with localhost defaults for development.
 *
 * `RP_ID` must be a bare domain (no scheme, no port); `RP_ORIGIN` is the full origin the
 * browser will report. A mismatch between them is the usual cause of verification failures.
 */
export function getRelyingParty(): RelyingPartyConfig {
  const rpID = process.env.RP_ID?.trim() || 'localhost';
  const rpName = process.env.RP_NAME?.trim() || 'Todo App';
  const origin = process.env.RP_ORIGIN?.trim() || `http://${rpID}:3000`;
  return { rpID, rpName, origin };
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
 * (Redis or a database table) instead — flagged in README under Deployment.
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
