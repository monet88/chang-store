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

const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const rateLimitResult = await rateLimiter.check('auth:login');
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

    await rateLimiter.storage.reset('auth:login');

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
