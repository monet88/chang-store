import type { DB } from '../server/db.ts';
import { updateJobProgress, createJobEvent } from '../server/db.ts';
import { BlobStorage } from '../server/blob.ts';

export interface WorkflowContext {
  db: DB;
  blob: BlobStorage;
  traceId: string;
}

export function createWorkflowContext(db: DB, traceId: string): WorkflowContext {
  return { db, blob: new BlobStorage(), traceId };
}

export async function withErrorHandling<T>(
  ctx: WorkflowContext,
  jobId: string,
  stepName: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    await createJobEvent(ctx.db, jobId, 'step_started', { step: stepName }, ctx.traceId);
    const result = await fn();
    try {
      await createJobEvent(ctx.db, jobId, 'step_completed', { step: stepName }, ctx.traceId);
    } catch (eventError) {
      console.error('[WORKFLOW] Failed to persist step_completed event:', eventError);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await createJobEvent(ctx.db, jobId, 'step_failed', { step: stepName, error: message }, ctx.traceId);
    } catch (eventError) {
      console.error('[WORKFLOW] Failed to persist step_failed event:', eventError);
    }
    throw err;
  }
}

export async function updateProgress(
  db: DB,
  jobId: string,
  done: number,
  total: number,
): Promise<void> {
  await updateJobProgress(db, jobId, done);
}
