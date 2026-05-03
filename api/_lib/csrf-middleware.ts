import { generateCsrfToken, createCsrfCookie, validateCsrfToken, CSRF_COOKIE_NAME } from './csrf.ts';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

export function withCsrf(handler: { fetch: (req: Request) => Promise<Response> }): { fetch: (req: Request) => Promise<Response> } {
  return {
    fetch: async (req: Request): Promise<Response> => {
      const hasCsrfCookie = hasCookie(req, CSRF_COOKIE_NAME);

      if (MUTATION_METHODS.has(req.method)) {
        const result = validateCsrfToken(req);
        if (!result.valid) {
          return new Response(
            JSON.stringify({ message: result.error ?? 'CSRF validation failed.' }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            },
          );
        }
      }

      const response = await handler.fetch(req);

      if (!hasCsrfCookie) {
        return addCsrfCookie(response);
      }

      return response;
    },
  };
}

function hasCookie(request: Request, name: string): boolean {
  const cookieHeader = request.headers.get('cookie') ?? '';
  return cookieHeader.split(';').some((segment) => {
    const eq = segment.indexOf('=');
    return eq > 0 && segment.slice(0, eq).trim() === name && segment.slice(eq + 1).trim().length > 0;
  });
}

function addCsrfCookie(response: Response): Response {
  const token = generateCsrfToken();
  const cookie = createCsrfCookie(token);
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
