export interface ErrorBody {
  message: string;
  retryAfter?: number;
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function methodNotAllowed(allowed: string[]): Response {
  return jsonResponse(
    { message: 'Method not allowed.' },
    {
      status: 405,
      headers: {
        Allow: allowed.join(', '),
      },
    },
  );
}

export function errorResponse(message: string, status: number, extraHeaders?: Record<string, string>): Response {
  return jsonResponse({ message }, { status, headers: extraHeaders });
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
