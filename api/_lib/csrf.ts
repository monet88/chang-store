import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function createCsrfCookie(token: string, env = process.env): string {
  const isSecure = env.NODE_ENV === 'production';
  return [
    `${CSRF_COOKIE_NAME}=${token}`,
    'Path=/',
    'SameSite=Strict',
    isSecure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function validateCsrfToken(request: Request): { valid: boolean; error?: string } {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  if (!cookieToken) {
    return { valid: false, error: 'Missing CSRF cookie.' };
  }

  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) {
    return { valid: false, error: 'Missing CSRF header.' };
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);

  if (a.byteLength !== b.byteLength) {
    return { valid: false, error: 'CSRF token mismatch.' };
  }

  if (!timingSafeEqual(a, b)) {
    return { valid: false, error: 'CSRF token mismatch.' };
  }

  return { valid: true };
}

function parseCookies(cookieHeader: string): Record<string, string> {
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
