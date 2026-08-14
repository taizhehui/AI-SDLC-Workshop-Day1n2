import { getDb } from './client';
import { toSingaporeTimestamp } from '../timezone';
import type { Authenticator } from './types';

interface AuthenticatorRow extends Omit<Authenticator, 'credential_public_key' | 'counter'> {
  credential_public_key: Buffer | Uint8Array;
  counter: number | null;
}

export interface CreateAuthenticatorInput {
  user_id: number;
  credential_id: string;
  credential_public_key: Uint8Array;
  counter?: number;
  transports?: string[] | null;
}

/**
 * `counter` is coalesced with `?? 0` on every read — the column can legitimately be NULL on
 * rows written by older code paths, and passing `undefined` into `verifyAuthenticationResponse`
 * breaks verification (see CLAUDE.md "Critical pitfall — counter ?? 0").
 */
function mapRow(row: AuthenticatorRow): Authenticator {
  return {
    ...row,
    credential_public_key: Buffer.from(row.credential_public_key),
    counter: row.counter ?? 0,
  };
}

/** CRUD for the `authenticators` table (PRP 11). One row per registered device. */
export const authenticatorDB = {
  findByCredentialId(credentialId: string): Authenticator | null {
    const row = getDb()
      .prepare(`SELECT * FROM authenticators WHERE credential_id = ?`)
      .get(credentialId) as AuthenticatorRow | undefined;
    return row ? mapRow(row) : null;
  },

  findByUserId(userId: number): Authenticator[] {
    const rows = getDb()
      .prepare(`SELECT * FROM authenticators WHERE user_id = ? ORDER BY id ASC`)
      .all(userId) as AuthenticatorRow[];
    return rows.map(mapRow);
  },

  create(input: CreateAuthenticatorInput): Authenticator {
    const result = getDb()
      .prepare(
        `INSERT INTO authenticators
           (user_id, credential_id, credential_public_key, counter, transports, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.user_id,
        input.credential_id,
        Buffer.from(input.credential_public_key),
        input.counter ?? 0,
        input.transports?.length ? JSON.stringify(input.transports) : null,
        toSingaporeTimestamp(),
      );

    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error('Failed to create authenticator');
    }
    return created;
  },

  findById(id: number): Authenticator | null {
    const row = getDb()
      .prepare(`SELECT * FROM authenticators WHERE id = ?`)
      .get(id) as AuthenticatorRow | undefined;
    return row ? mapRow(row) : null;
  },

  updateCounter(id: number, counter: number | undefined): void {
    getDb()
      .prepare(`UPDATE authenticators SET counter = ? WHERE id = ?`)
      .run(counter ?? 0, id);
  },

  /** Parsed `transports` list, or an empty array when unset/corrupt. */
  parseTransports(authenticator: Authenticator): string[] {
    if (!authenticator.transports) return [];
    try {
      const parsed: unknown = JSON.parse(authenticator.transports);
      return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
    } catch {
      return [];
    }
  },
};
