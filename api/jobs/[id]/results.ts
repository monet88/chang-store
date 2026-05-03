import { withCsrf } from '../../_lib/csrf-middleware';
import { jsonResponse, errorResponse, methodNotAllowed } from '../../_lib/http';
import { getAuthenticatedSessionFromRequest } from '../../_lib/auth';
import { getNeonPool } from '../../../server/neon';
import { getJobById, getJobAssets } from '../../../server/db';

function extractJobId(url: string): string | null {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  // path: api/jobs/:id/results
  const apiIndex = segments.indexOf('api');
  if (apiIndex === -1) return null;
  return segments[apiIndex + 2] ?? null;
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

    const jobId = extractJobId(request.url);
    if (!jobId) {
      return jsonResponse({ message: 'Job ID is required.' }, { status: 400 });
    }

    const job = await getJobById(db, jobId, session.userId);
    if (!job) {
      const jobWithoutOwner = await getJobById(db, jobId);
      if (!jobWithoutOwner) {
        return errorResponse('Job not found.', 404);
      }
      return errorResponse('Forbidden.', 403);
    }

    if (job.status !== 'completed' && job.status !== 'partial') {
      return jsonResponse({ message: 'Job not complete.' }, { status: 409 });
    }

    const assets = await getJobAssets(db, jobId);
    const results = assets.filter(a => a.kind === 'output');

    return jsonResponse({ job, results }, { status: 200 });
  },
});

export default handler;
