import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_COOKIE_NAME,
  authenticateSeededUser,
  createSessionCookie,
  createSessionToken,
  getAuthenticatedUserFromRequest,
  getSeededUsers,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from '../../api/_lib/auth';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  validateCsrfToken,
} from '../../api/_lib/csrf';
import { withCsrf } from '../../api/_lib/csrf-middleware';
import logoutRoute from '../../api/auth/logout';

describe('auth server helpers', () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('AUTH_SEEDED_USERS_JSON', JSON.stringify([
      {
        username: 'demo',
        displayName: 'Demo User',
        passwordHash: await hashPassword('demo1234', 'fixed-salt'),
      },
    ]));
  });

  it('hashes and verifies a password asynchronously', async () => {
    const hash = await hashPassword('secret123');
    expect(hash.startsWith('scrypt$')).toBe(true);

    const valid = await verifyPassword('secret123', hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword('wrong', hash);
    expect(invalid).toBe(false);
  });


  it('returns false for plaintext passwords with equal character length but different UTF-8 byte length', async () => {
    await expect(verifyPassword('é', 'a')).resolves.toBe(false);
  });

  it('authenticates a seeded user with a hashed password', async () => {
    const user = await authenticateSeededUser('demo', 'demo1234');

    expect(user).toEqual({
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded',
      role: 'user',
    });
  });

  it('rejects an unknown username', async () => {
    const user = await authenticateSeededUser('nobody', 'demo1234');
    expect(user).toBeNull();
  });

  it('honors an intentionally empty seeded user list', () => {
    vi.stubEnv('AUTH_SEEDED_USERS_JSON', '[]');

    expect(getSeededUsers()).toEqual([]);
  });

  it('rejects a wrong password for a known user', async () => {
    const user = await authenticateSeededUser('demo', 'bad-pass');
    expect(user).toBeNull();
  });

  it('creates and verifies a signed session token', () => {
    const user = {
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded' as const,
      role: 'user' as const,
    };

    const token = createSessionToken(user, 1_000);
    expect(verifySessionToken(token, 2_000)).toEqual(user);
  });

  it('rejects a tampered session token', () => {
    const user = {
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded' as const,
      role: 'user' as const,
    };
    const token = createSessionToken(user, 1_000);

    const [payload, signature] = token.split('.');
    const tamperedToken = `${payload}.${signature.replace('A', 'B')}`;
    expect(verifySessionToken(tamperedToken, 2_000)).toBeNull();
  });

  it('rejects a session token when signature byte length differs', () => {
    const user = {
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded' as const,
      role: 'user' as const,
    };
    const [payload] = createSessionToken(user, 1_000).split('.');

    expect(verifySessionToken(`${payload}.é`, 2_000)).toBeNull();
  });

  it('rejects an expired session token', () => {
    const user = {
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded' as const,
      role: 'user' as const,
    };
    vi.stubEnv('AUTH_SESSION_TTL_HOURS', '0.0001');
    const token = createSessionToken(user, 1_000);

    expect(verifySessionToken(token, 1_000 + 60 * 60 * 1000)).toBeNull();
  });

  it('rejects a token with a malformed payload', () => {
    const user = {
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded' as const,
      role: 'user' as const,
    };
    const token = createSessionToken(user, 1_000);
    const [payload, signature] = token.split('.');

    const malformedPayloadToken = `${payload}xxx.${signature}`;
    expect(verifySessionToken(malformedPayloadToken, 2_000)).toBeNull();
  });

  it('reads the authenticated user from a cookie-bearing request', () => {
    const user = {
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded' as const,
      role: 'user' as const,
    };
    const token = createSessionToken(user, 1_000);
    const request = new Request('https://example.com/api/auth/session', {
      headers: {
        cookie: createSessionCookie(token),
      },
    });

    expect(getAuthenticatedUserFromRequest(request, 2_000)).toEqual(user);
  });

  it('writes the auth cookie name into the session cookie', () => {
    const cookie = createSessionCookie('abc.def');
    expect(cookie.startsWith(`${AUTH_COOKIE_NAME}=abc.def`)).toBe(true);
  });
});

describe('auth routes', () => {
  it('clears the auth cookie when logout has no active session', async () => {
    const token = generateCsrfToken();
    const response = await logoutRoute.fetch(new Request('https://example.com/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: token,
      },
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get('Set-Cookie')).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});

describe('csrf token helpers', () => {
  it('generates a 64-character hex token', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it('generates unique tokens on each call', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });

  it('validates a matching cookie and header token', () => {
    const token = generateCsrfToken();
    const request = new Request('https://example.com/api', {
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: token,
      },
    });

    expect(validateCsrfToken(request)).toEqual({ valid: true });
  });

  it('returns error for missing CSRF cookie', () => {
    const request = new Request('https://example.com/api', {
      headers: {
        [CSRF_HEADER_NAME]: generateCsrfToken(),
      },
    });

    expect(validateCsrfToken(request)).toEqual({
      valid: false,
      error: 'Missing CSRF cookie.',
    });
  });

  it('returns error for missing CSRF header', () => {
    const token = generateCsrfToken();
    const request = new Request('https://example.com/api', {
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });

    expect(validateCsrfToken(request)).toEqual({
      valid: false,
      error: 'Missing CSRF header.',
    });
  });

  it('returns error for mismatched tokens', () => {
    const token = generateCsrfToken();
    const request = new Request('https://example.com/api', {
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: generateCsrfToken(),
      },
    });

    expect(validateCsrfToken(request)).toEqual({
      valid: false,
      error: 'CSRF token mismatch.',
    });
  });

  it('returns error for tokens of different lengths', () => {
    const token = generateCsrfToken();
    const request = new Request('https://example.com/api', {
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: 'short',
      },
    });

    expect(validateCsrfToken(request)).toEqual({
      valid: false,
      error: 'CSRF token mismatch.',
    });
  });
});

describe('csrf middleware', () => {
  it('allows GET requests and sets a CSRF cookie', async () => {
    const handler = withCsrf({
      async fetch() {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const response = await handler.fetch(new Request('http://test', { method: 'GET' }));
    expect(response.status).toBe(200);

    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).not.toBeNull();
    expect(setCookie!.startsWith(`${CSRF_COOKIE_NAME}=`)).toBe(true);
  });

  it('allows HEAD requests', async () => {
    const handler = withCsrf({
      async fetch() {
        return new Response(null, { status: 200 });
      },
    });

    const response = await handler.fetch(new Request('http://test', { method: 'HEAD' }));
    expect(response.status).toBe(200);
  });

  it('allows OPTIONS requests', async () => {
    const handler = withCsrf({
      async fetch() {
        return new Response(null, { status: 204 });
      },
    });

    const response = await handler.fetch(new Request('http://test', { method: 'OPTIONS' }));
    expect(response.status).toBe(204);
  });

  it('blocks POST without CSRF token', async () => {
    const handler = withCsrf({
      async fetch() {
        return new Response(JSON.stringify({ ok: true }));
      },
    });

    const response = await handler.fetch(new Request('http://test', { method: 'POST' }));
    expect(response.status).toBe(403);
  });

  it('allows POST with valid CSRF token', async () => {
    const token = generateCsrfToken();
    const handler = withCsrf({
      async fetch() {
        return new Response(JSON.stringify({ ok: true }));
      },
    });

    const response = await handler.fetch(new Request('http://test', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: token,
      },
    }));
    expect(response.status).toBe(200);
  });

  it('blocks POST with mismatched CSRF token', async () => {
    const token = generateCsrfToken();
    const handler = withCsrf({
      async fetch() {
        return new Response(JSON.stringify({ ok: true }));
      },
    });

    const response = await handler.fetch(new Request('http://test', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: generateCsrfToken(),
      },
    }));
    expect(response.status).toBe(403);
  });

  it('blocks PUT without CSRF token', async () => {
    const handler = withCsrf({
      async fetch() {
        return new Response(JSON.stringify({ ok: true }));
      },
    });

    const response = await handler.fetch(new Request('http://test', { method: 'PUT' }));
    expect(response.status).toBe(403);
  });

  it('does not add CSRF cookie on GET when one is already present', async () => {
    const token = generateCsrfToken();
    const handler = withCsrf({
      async fetch() {
        return new Response(JSON.stringify({ ok: true }));
      },
    });

    const response = await handler.fetch(new Request('http://test', {
      method: 'GET',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('reissues a CSRF cookie when the existing cookie value is empty', async () => {
    const handler = withCsrf({
      async fetch() {
        return new Response(JSON.stringify({ ok: true }));
      },
    });

    const response = await handler.fetch(new Request('http://test', {
      method: 'GET',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=`,
      },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain(`${CSRF_COOKIE_NAME}=`);
  });
});
