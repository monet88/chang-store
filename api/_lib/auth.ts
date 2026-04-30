import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedUser } from '../../src/types';

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export const AUTH_COOKIE_NAME = 'chang_store_session';
const DEV_AUTH_SECRET = 'chang-store-dev-auth-secret';
const DEV_DEMO_PASSWORD = 'demo1234';
const DEFAULT_SESSION_TTL_HOURS = 72;

interface SeededUserRecord {
  username: string;
  displayName: string;
  provisioning: 'seeded';
  password?: string;
  passwordHash?: string;
}

interface SessionPayload {
  sub: string;
  name: string;
  provisioning: 'seeded';
  exp: number;
}

const encodeBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');
const decodeBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const normalizeUser = (value: unknown): SeededUserRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<SeededUserRecord>;
  if (typeof record.username !== 'string' || record.username.trim().length === 0) {
    return null;
  }

  const hasPassword = typeof record.password === 'string' && record.password.length > 0;
  const hasPasswordHash = typeof record.passwordHash === 'string' && record.passwordHash.length > 0;
  if (!hasPassword && !hasPasswordHash) {
    return null;
  }

  return {
    username: record.username.trim(),
    displayName: typeof record.displayName === 'string' && record.displayName.trim().length > 0
      ? record.displayName.trim()
      : record.username.trim(),
    provisioning: 'seeded',
    password: hasPassword ? record.password : undefined,
    passwordHash: hasPasswordHash ? record.passwordHash : undefined,
  };
};

export async function hashPassword(password: string, salt = randomBytes(16).toString('hex')): Promise<string> {
  const derived = (await scryptAsync(password, salt, 64)).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export async function verifyPassword(password: string, expected: string): Promise<boolean> {
  if (expected.startsWith('scrypt$')) {
    const [, salt, digest] = expected.split('$');
    if (!salt || !digest) {
      return false;
    }

    const actual = await scryptAsync(password, salt, 64);
    const expectedBuffer = Buffer.from(digest, 'hex');
    if (actual.byteLength !== expectedBuffer.byteLength) {
      return false;
    }

    return timingSafeEqual(actual, expectedBuffer);
  }

  if (password.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(password), Buffer.from(expected));
}

function getDefaultSeededUsers(): SeededUserRecord[] {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  return [
    {
      username: 'demo',
      displayName: 'Demo User',
      provisioning: 'seeded',
      password: DEV_DEMO_PASSWORD,
    },
  ];
}

export function getSeededUsers(env = process.env): SeededUserRecord[] {
  const raw = env.AUTH_SEEDED_USERS_JSON;
  if (!raw) {
    return getDefaultSeededUsers();
  }

  try {
    const parsed = JSON.parse(raw) as unknown[];
    const users = parsed
      .map(normalizeUser)
      .filter((value): value is SeededUserRecord => value !== null);

    return users.length > 0 ? users : getDefaultSeededUsers();
  } catch {
    return getDefaultSeededUsers();
  }
}

export function toAuthenticatedUser(user: SeededUserRecord): AuthenticatedUser {
  return {
    username: user.username,
    displayName: user.displayName,
    provisioning: 'seeded',
  };
}

export async function authenticateSeededUser(username: string, password: string): Promise<AuthenticatedUser | null> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password) {
    return null;
  }

  const user = getSeededUsers().find((entry) => entry.username === normalizedUsername);
  if (!user) {
    return null;
  }

  if (user.passwordHash && await verifyPassword(password, user.passwordHash)) {
    return toAuthenticatedUser(user);
  }

  if (user.password && await verifyPassword(password, user.password)) {
    return toAuthenticatedUser(user);
  }

  return null;
}

function getAuthSecret(env = process.env): string {
  if (env.AUTH_SECRET && env.AUTH_SECRET.trim().length > 0) {
    return env.AUTH_SECRET;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production.');
  }

  return DEV_AUTH_SECRET;
}

function getSessionTtlHours(env = process.env): number {
  const parsed = Number(env.AUTH_SESSION_TTL_HOURS ?? DEFAULT_SESSION_TTL_HOURS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SESSION_TTL_HOURS;
  }

  return parsed;
}

function signValue(value: string, env = process.env): string {
  return createHmac('sha256', getAuthSecret(env)).update(value).digest('base64url');
}

export function createSessionToken(user: AuthenticatedUser, now = Date.now(), env = process.env): string {
  const payload: SessionPayload = {
    sub: user.username,
    name: user.displayName,
    provisioning: user.provisioning,
    exp: now + getSessionTtlHours(env) * 60 * 60 * 1000,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, env);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string, now = Date.now(), env = process.env): AuthenticatedUser | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload, env);
  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as SessionPayload;
    if (typeof payload.sub !== 'string' || typeof payload.name !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }

    if (payload.exp <= now) {
      return null;
    }

    const matchingUser = getSeededUsers(env).find((user) => user.username === payload.sub);
    if (!matchingUser) {
      return null;
    }

    return toAuthenticatedUser(matchingUser);
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return accumulator;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (name) {
        accumulator[name] = value;
      }
      return accumulator;
    }, {});
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const cookies = parseCookies(request.headers.get('cookie'));
  return cookies[AUTH_COOKIE_NAME] ?? null;
}

export function getAuthenticatedUserFromRequest(request: Request, now = Date.now(), env = process.env): AuthenticatedUser | null {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return null;
  }

  return verifySessionToken(token, now, env);
}

export function createSessionCookie(token: string, env = process.env): string {
  const isSecure = env.NODE_ENV === 'production';
  const maxAge = getSessionTtlHours(env) * 60 * 60;
  return [
    `${AUTH_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    isSecure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function clearSessionCookie(env = process.env): string {
  const isSecure = env.NODE_ENV === 'production';
  return [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    isSecure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}
