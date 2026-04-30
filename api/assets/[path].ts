import { withCsrf } from '../_lib/csrf-middleware';
import { errorResponse, methodNotAllowed } from '../_lib/http';
import { getAuthenticatedUserFromRequest } from '../_lib/auth';
import { head } from '@vercel/blob';

function extractBlobPath(url: string): string | null {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  if (apiIndex === -1) return null;
  return segments.slice(apiIndex + 2).join('/');
}

const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    const session = getAuthenticatedUserFromRequest(request);
    if (!session) {
      return errorResponse('Authentication required.', 401);
    }

    const blobPath = extractBlobPath(request.url);
    if (!blobPath) {
      return errorResponse('Blob path is required.', 400);
    }

    try {
      const blob = await head(blobPath, {
        token: process.env.BLOB_READ_WRITE_TOKEN!,
      });
      const response = await fetch(blob.url);
      if (!response.ok) {
        return errorResponse('Blob not found.', 404);
      }
      const data = await response.arrayBuffer();
      return new Response(data, {
        headers: {
          'Content-Type': blob.contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (err) {
      console.error('[assets] Failed to fetch blob:', err);
      return errorResponse('Failed to fetch blob.', 500);
    }
  },
});

export default handler;
