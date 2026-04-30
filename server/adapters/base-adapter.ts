import { createHash } from 'node:crypto';
import type { DB, JobRecord, JobAssetRecord } from '../db';
import {
  createJob,
  getJobById,
  updateJobStatus,
  finalizeJobOutputs,
  createJobEvent,
} from '../db';
import { validateJobPayload } from '../validation';
import { canTransition } from '../jobs';

export async function submitJob(
  db: DB,
  userId: string,
  feature: string,
  payload: unknown,
  traceId?: string,
): Promise<JobRecord> {
  validateJobPayload(feature, payload);

  const idempotencyKey = createHash('sha256')
    .update(`${userId}:${feature}:${JSON.stringify(payload)}`)
    .digest('hex');

  const job = await createJob(db, userId, feature, idempotencyKey, payload as Record<string, unknown>);
  await createJobEvent(db, job.id, 'queued', { feature }, traceId);
  return job;
}

export async function completeJob(
  db: DB,
  jobId: string,
  assets: Array<{ blobPath: string; mimeType: string }>,
  traceId?: string,
): Promise<JobAssetRecord[]> {
  const job = await getJobById(db, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  if (!canTransition(job.status, 'completed')) {
    throw new Error(`Cannot transition job ${jobId} from ${job.status} to completed`);
  }

  return finalizeJobOutputs(db, jobId, {
    status: 'completed',
    assets,
    eventPayload: { assetCount: assets.length },
    traceId,
  });
}

export async function failJob(
  db: DB,
  jobId: string,
  errorCode: string,
  errorMessage: string,
  traceId?: string,
): Promise<void> {
  const job = await getJobById(db, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  if (!canTransition(job.status, 'failed')) {
    throw new Error(`Cannot transition job ${jobId} from ${job.status} to failed`);
  }

  await updateJobStatus(db, jobId, 'failed', errorCode, errorMessage);
  await createJobEvent(db, jobId, 'failed', { errorCode, errorMessage }, traceId);
}

export async function partialJob(
  db: DB,
  jobId: string,
  assets: Array<{ blobPath: string; mimeType: string }>,
  errorCode: string,
  errorMessage: string,
  traceId?: string,
): Promise<JobAssetRecord[]> {
  const job = await getJobById(db, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  if (!canTransition(job.status, 'partial')) {
    throw new Error(`Cannot transition job ${jobId} from ${job.status} to partial`);
  }

  return finalizeJobOutputs(db, jobId, {
    status: 'partial',
    assets,
    errorCode,
    errorMessage,
    eventPayload: { assetCount: assets.length, errorCode },
    traceId,
  });
}
