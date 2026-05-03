import { clearSessionCookie, getAuthenticatedUserFromRequest } from '../_lib/auth';
import { withCsrf } from '../_lib/csrf-middleware';
import { jsonResponse, methodNotAllowed } from '../_lib/http';

const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const user = getAuthenticatedUserFromRequest(request);
    if (!user) {
      return jsonResponse(
        { message: 'No active session.' },
        {
          status: 401,
          headers: {
            'Set-Cookie': clearSessionCookie(),
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    return jsonResponse(
      { ok: true },
      {
        status: 200,
        headers: {
          'Set-Cookie': clearSessionCookie(),
          'Cache-Control': 'no-store',
        },
      },
    );
  },
});

export default handler;
