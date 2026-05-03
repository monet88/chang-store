import { createHash } from 'node:crypto';
import { withCsrf } from '../_lib/csrf-middleware';
import { jsonResponse, errorResponse, methodNotAllowed, readJsonBody } from '../_lib/http';
import { getAuthenticatedUserFromRequest } from '../_lib/auth';
import { extractTraceId } from '../_lib/trace';
import { getNeonPool } from '../../server/neon';
import { createJob, createJobEvent, listJobsByUser, findJobByIdempotencyKey, sweepStaleJobs } from '../../server/db';
import { validateJobPayload } from '../../server/validation';
import { ZodError } from 'zod';
import { formatZodErrors } from '../../server/validation';
import { executeJob } from '../../server/workflows/job-runner';

interface CreateJobBody {
  feature: string;
  payload: Record<string, unknown>;
}

const MAX_LIST_LIMIT = 100;
const MAX_LIST_OFFSET = 1_000;

function parseBoundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function getSession(request: Request): { userId: string; username: string } | null {
  const user = getAuthenticatedUserFromRequest(request);
  if (!user) return null;
  return { userId: user.username, username: user.displayName };
}

const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    const session = getSession(request);
    if (!session) {
      return errorResponse('Authentication required.', 401);
    }

    const traceId = extractTraceId(request);

    if (request.method === 'POST') {
      return handleCreate(request, session, traceId);
    }

    if (request.method === 'GET') {
      return handleList(request, session);
    }

    return methodNotAllowed(['GET', 'POST']);
  },
});

async function handleCreate(request: Request, session: { userId: string }, traceId: string): Promise<Response> {
  const body = await readJsonBody<CreateJobBody>(request);
  if (!body?.feature || !body?.payload) {
    return jsonResponse({ message: 'feature and payload are required.' }, { status: 400 });
  }

  let validatedPayload: Record<string, unknown>;
  try {
    validatedPayload = validateJobPayload(body.feature, body.payload) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonResponse({ message: 'Validation failed.', errors: formatZodErrors(err) }, { status: 422 });
    }
    if (err instanceof Error) {
      return jsonResponse({ message: err.message }, { status: 400 });
    }
    throw err;
  }

  const idempotencyKey = createHash('sha256')
    .update(`${session.userId}:${body.feature}:${JSON.stringify(validatedPayload)}`)
    .digest('hex');

  const db = getNeonPool(process.env.DATABASE_URL!);

  let job;
  try {
    job = await createJob(db, session.userId, body.feature, idempotencyKey, validatedPayload);
  } catch (err: unknown) {
    const isUniqueViolation =
      typeof err === 'object' && err !== null &&
      'code' in err && (err as Record<string, unknown>).code === '23505';
    if (isUniqueViolation) {
      const existing = await findJobByIdempotencyKey(db, session.userId, idempotencyKey);
      if (existing) {
        return jsonResponse(existing, { status: 200 });
      }
      throw err;
    }
    throw err;
  }

  await createJobEvent(db, job.id, 'queued', { feature: body.feature }, traceId);

  // Trigger async execution — fire and forget (errors logged in executeJob)
  void executeJob(db, job, traceId).catch((err) => {
    console.error(`[JOBS] Background execution failed for job ${job.id}:`, err);
  });

  return jsonResponse(job, { status: 201 });
}

async function handleList(request: Request, session: { userId: string }): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const limit = parseBoundedInteger(url.searchParams.get('limit'), 50, 1, MAX_LIST_LIMIT);
  const offset = parseBoundedInteger(url.searchParams.get('offset'), 0, 0, MAX_LIST_OFFSET);

  const db = getNeonPool(process.env.DATABASE_URL!);

  try {
    await sweepStaleJobs(db, session.userId);
  } catch (err) {
    console.error('[JOBS] Stale sweep failed, proceeding with list:', err);
  }

  const jobs = await listJobsByUser(
    db,
    session.userId,
    status as 'queued' | 'running' | 'completed' | 'failed' | 'partial' | undefined,
    limit,
    offset,
  );

  return jsonResponse(jobs, {
    status: 200,
    headers: {
      'X-Poll-Interval': '5',
      'Retry-After': '15',
    },
  });
}

export default handler;
