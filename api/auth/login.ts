import { authenticateSeededUser, createSessionCookie, createSessionToken } from '../_lib/auth';
import { withCsrf } from '../_lib/csrf-middleware';
import { errorResponse, jsonResponse, methodNotAllowed, readJsonBody } from '../_lib/http';
import { createRateLimitHeaders, InMemoryRateLimitStorage, checkRateLimit } from '../_lib/rate-limiter';
import type { RateLimiter } from '../_lib/rate-limiter';
import { createPostgresRateLimiter } from '../../server/rate-limiter-storage.ts';
import { getNeonPool } from '../../server/neon.ts';

function createRateLimiter(): RateLimiter {
  if (process.env.DATABASE_URL) {
    const db = getNeonPool(process.env.DATABASE_URL);
    return createPostgresRateLimiter(db);
  }
  const storage = new InMemoryRateLimitStorage();
  return {
    storage,
    check: (identifier: string) => checkRateLimit(storage, identifier),
  };
}

const rateLimiter = createRateLimiter();

interface LoginRequestBody {
  username?: string;
  password?: string;
}

function getRateLimitIdentifier(request: Request): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const xRealIp = request.headers.get('x-real-ip')?.trim();
  if (xRealIp) {
    return xRealIp;
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  if (forwardedFor) {
    return forwardedFor;
  }

  return 'unknown';
}

const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const rateLimitKey = `auth:login:${getRateLimitIdentifier(request)}`;
    const rateLimitResult = await rateLimiter.check(rateLimitKey);
    if (!rateLimitResult.allowed) {
      return errorResponse(
        'Too many login attempts. Please try again later.',
        429,
        createRateLimitHeaders(rateLimitResult.retryAfter!),
      );
    }

    const body = await readJsonBody<LoginRequestBody>(request);
    if (!body?.username || !body.password) {
      return jsonResponse({ message: 'Username and password are required.' }, { status: 400 });
    }

    const user = await authenticateSeededUser(body.username, body.password);
    if (!user) {
      return jsonResponse({ message: 'Invalid username or password.' }, { status: 401 });
    }

    await rateLimiter.storage.reset(rateLimitKey);

    const token = createSessionToken(user);
    return jsonResponse(
      { user },
      {
        status: 200,
        headers: {
          'Set-Cookie': createSessionCookie(token),
          'Cache-Control': 'no-store',
        },
      },
    );
  },
});

export default handler;
