import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { challengeStore, getRelyingParty } from '@/lib/webauthn';

const RP_ENV_KEYS = [
  'RP_ID',
  'RP_NAME',
  'RP_ORIGIN',
  'RAILWAY_PUBLIC_DOMAIN',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
] as const;

const requestWith = (headers: Record<string, string>): Request =>
  new Request('http://example.test/api/auth/login-options', { headers });

describe('getRelyingParty', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(RP_ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of RP_ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of RP_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('falls back to localhost with no configuration and no request', () => {
    expect(getRelyingParty()).toEqual({
      rpID: 'localhost',
      rpName: 'Todo App',
      origin: 'http://localhost:3000',
    });
  });

  it('prefers an explicit RP_ID over everything else', () => {
    process.env.RP_ID = 'explicit.example.com';
    process.env.RAILWAY_PUBLIC_DOMAIN = 'ignored.up.railway.app';

    const { rpID } = getRelyingParty(requestWith({ host: 'also-ignored.test' }));
    expect(rpID).toBe('explicit.example.com');
  });

  it('uses the Railway-injected domain when RP_ID is unset', () => {
    process.env.RAILWAY_PUBLIC_DOMAIN = 'myapp.up.railway.app';

    expect(getRelyingParty()).toMatchObject({
      rpID: 'myapp.up.railway.app',
      origin: 'https://myapp.up.railway.app',
    });
  });

  it('uses a Vercel domain when present', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'myapp.vercel.app';
    expect(getRelyingParty().rpID).toBe('myapp.vercel.app');
  });

  it('derives the host from the request when nothing is configured', () => {
    const config = getRelyingParty(
      requestWith({ host: 'derived.example.com', 'x-forwarded-proto': 'https' }),
    );

    expect(config.rpID).toBe('derived.example.com');
    expect(config.origin).toBe('https://derived.example.com');
  });

  it('prefers x-forwarded-host over host behind a proxy', () => {
    const config = getRelyingParty(
      requestWith({ host: 'internal:8080', 'x-forwarded-host': 'public.example.com' }),
    );
    expect(config.rpID).toBe('public.example.com');
  });

  it('takes the first entry of a comma-joined forwarded header', () => {
    const config = getRelyingParty(
      requestWith({ 'x-forwarded-host': 'first.example.com, second.example.com' }),
    );
    expect(config.rpID).toBe('first.example.com');
  });

  it('strips the port from the RP ID but keeps it in the origin', () => {
    const config = getRelyingParty(
      requestWith({ host: 'localhost:3000', 'x-forwarded-proto': 'http' }),
    );

    // The RP ID must be a bare hostname; the origin must match what the browser reports.
    expect(config.rpID).toBe('localhost');
    expect(config.origin).toBe('http://localhost:3000');
  });

  it('handles a bracketed IPv6 host', () => {
    const config = getRelyingParty(requestWith({ host: '[::1]:3000' }));
    expect(config.rpID).toBe('[::1]');
  });

  it('defaults to https for a non-local host', () => {
    expect(getRelyingParty(requestWith({ host: 'secure.example.com' })).origin).toBe(
      'https://secure.example.com',
    );
  });

  it('honours an explicit RP_ORIGIN and trims a trailing slash', () => {
    process.env.RP_ID = 'example.com';
    process.env.RP_ORIGIN = 'https://example.com/';

    expect(getRelyingParty().origin).toBe('https://example.com');
  });

  it('uses RP_NAME when provided', () => {
    process.env.RP_NAME = 'My Todos';
    expect(getRelyingParty().rpName).toBe('My Todos');
  });
});

describe('challengeStore', () => {
  beforeEach(() => challengeStore.clear());

  it('round-trips a saved challenge', () => {
    challengeStore.save('login', 'alice', 'abc123');
    expect(challengeStore.consume('login', 'alice')).toBe('abc123');
  });

  it('is case-insensitive on the username', () => {
    challengeStore.save('register', 'Alice', 'xyz');
    expect(challengeStore.consume('register', 'alice')).toBe('xyz');
  });

  it('is single use — a replay returns null', () => {
    challengeStore.save('login', 'bob', 'once');
    expect(challengeStore.consume('login', 'bob')).toBe('once');
    expect(challengeStore.consume('login', 'bob')).toBeNull();
  });

  it('keeps register and login challenges separate', () => {
    challengeStore.save('register', 'carol', 'reg');
    expect(challengeStore.consume('login', 'carol')).toBeNull();
    expect(challengeStore.consume('register', 'carol')).toBe('reg');
  });

  it('returns null for an unknown username', () => {
    expect(challengeStore.consume('login', 'nobody')).toBeNull();
  });
});
