import { getAuthenticatedUserFromRequest } from '../_lib/auth';
import { withCsrf } from '../_lib/csrf-middleware';
import { jsonResponse, methodNotAllowed } from '../_lib/http';

const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    const user = getAuthenticatedUserFromRequest(request);
    if (!user) {
      return jsonResponse(
        { user: null, message: 'No active session.' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    return jsonResponse(
      { user },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  },
});

export default handler;
