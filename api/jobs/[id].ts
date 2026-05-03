import { withCsrf } from '../_lib/csrf-middleware';
import { jsonResponse, errorResponse, methodNotAllowed, readJsonBody } from '../_lib/http';
import { getAuthenticatedSessionFromRequest } from '../_lib/auth';
import { getNeonPool } from '../../server/neon';
import { getJobById, getJobEvents } from '../../server/db';
import { reconcileJobOutputs } from '../../server/adapters';

interface ReconcileBody {
  deleteOrphans?: boolean;
}

function extractJobId(url: string): string | null {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  // path: api/jobs/:id
  const apiIndex = segments.indexOf('api');
  if (apiIndex === -1) return null;
  return segments[apiIndex + 2] ?? null;
}

const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return methodNotAllowed(['GET', 'POST']);
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

    if (request.method === 'GET') {
      const events = await getJobEvents(db, jobId);
      return jsonResponse({ job, events }, { status: 200 });
    }

    if (job.status === 'queued' || job.status === 'running') {
      return errorResponse('Job is still running.', 409);
    }

    const body = await readJsonBody<ReconcileBody>(request);
    const reconciliation = await reconcileJobOutputs(db, jobId, {
      deleteOrphans: body?.deleteOrphans === true,
    });

    return jsonResponse({ job, reconciliation }, { status: 200 });
  },
});

export default handler;
