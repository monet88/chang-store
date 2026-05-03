import { withCsrf } from '../_lib/csrf-middleware.js';
import { errorResponse, methodNotAllowed } from '../_lib/http.js';
import { getAuthenticatedSessionFromRequest } from '../_lib/auth.js';
import { getNeonPool } from '../../server/neon.js';
import { head } from '@vercel/blob';

function extractBlobPath(url: string): string | null {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  if (apiIndex === -1) return null;
  const encodedBlobPath = segments.slice(apiIndex + 2).join('/');
  if (!encodedBlobPath) return null;

  try {
    return decodeURIComponent(encodedBlobPath);
  } catch {
    return null;
  }
}

async function userCanAccessBlob(db: ReturnType<typeof getNeonPool>, blobPath: string, userId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT ja.id
     FROM job_assets ja
     INNER JOIN jobs j ON j.id = ja.job_id
     WHERE ja.blob_path = $1 AND j.user_id = $2
     LIMIT 1`,
    [blobPath, userId],
  );
  return result.rows.length > 0;
}

const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    const db = getNeonPool(process.env.DATABASE_URL!);
    const session = await getAuthenticatedSessionFromRequest(db, request);
    if (!session) {
      return errorResponse('Authentication required.', 401);
    }

    const blobPath = extractBlobPath(request.url);
    if (!blobPath) {
      return errorResponse('Blob path is required.', 400);
    }

    if (!(await userCanAccessBlob(db, blobPath, session.userId))) {
      return errorResponse('Blob not found.', 404);
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
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (err) {
      console.error('[assets] Failed to fetch blob:', err);
      return errorResponse('Failed to fetch blob.', 500);
    }
  },
});

export default handler;
