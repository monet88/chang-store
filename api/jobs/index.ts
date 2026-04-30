import { createHash } from 'node:crypto';
import { withCsrf } from '../_lib/csrf-middleware';
import { jsonResponse, errorResponse, methodNotAllowed, readJsonBody } from '../_lib/http';
import { getAuthenticatedUserFromRequest } from '../_lib/auth';
import { extractTraceId } from '../_lib/trace';
import { getNeonPool } from '../../server/neon';
import { createJob, createJobEvent, listJobsByUser } from '../../server/db';
import { validateJobPayload } from '../../server/validation';
import { ZodError } from 'zod';
import { formatZodErrors } from '../../server/validation';

interface CreateJobBody {
  feature: string;
  payload: Record<string, unknown>;
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
      const existing = await findJobByIdempotencyKey(db, idempotencyKey);
      if (existing) {
        return jsonResponse(existing, { status: 200 });
      }
      throw err;
    }
    throw err;
  }

  await createJobEvent(db, job.id, 'queued', { feature: body.feature }, traceId);

  return jsonResponse(job, { status: 201 });
}

async function findJobByIdempotencyKey(db: ReturnType<typeof getNeonPool>, key: string) {
  const result = await db.query(
    'SELECT * FROM jobs WHERE idempotency_key = $1',
    [key],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id,
    user_id: row.user_id,
    feature: row.feature,
    status: row.status,
    idempotency_key: row.idempotency_key,
    input_payload_json: row.input_payload_json,
    workflow_run_id: row.workflow_run_id,
    progress_total: row.progress_total,
    progress_done: row.progress_done,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error_code: row.error_code,
    error_message: row.error_message,
  };
}

async function handleList(request: Request, session: { userId: string }): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const db = getNeonPool(process.env.DATABASE_URL!);
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
