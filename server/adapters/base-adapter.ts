import { createHash } from 'node:crypto';
import type { DB, JobRecord, JobAssetRecord } from '../db';
import {
  createJob,
  getJobById,
  getJobAssets,
  updateJobStatus,
  finalizeJobOutputs,
  createJobEvent,
} from '../db';
import { BlobStorage } from '../blob';
import { validateJobPayload } from '../validation';
import { canTransition } from '../jobs';

interface BlobOperations {
  deleteBlob(path: string): Promise<void>;
  listBlobs(prefix: string): Promise<Array<{ path: string; url: string }>>;
}

export interface ReconcileJobOutputsOptions {
  deleteOrphans?: boolean;
  blob?: BlobOperations;
}

export interface ReconcileJobOutputsResult {
  jobId: string;
  outputPrefix: string;
  persistedOutputPaths: string[];
  blobOutputPaths: string[];
  orphanedOutputPaths: string[];
  deletedOutputPaths: string[];
  deleteFailures: Array<{ blobPath: string; errorMessage: string }>;
}

export async function submitJob(
  db: DB,
  userId: string,
  feature: string,
  payload: unknown,
  traceId?: string,
): Promise<JobRecord> {
  const validatedPayload = validateJobPayload(feature, payload);

  const idempotencyKey = createHash('sha256')
    .update(`${userId}:${feature}:${JSON.stringify(validatedPayload)}`)
    .digest('hex');

  const job = await createJob(db, userId, feature, idempotencyKey, validatedPayload as Record<string, unknown>);
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
    expectedStatus: job.status,
  });
}

export async function failJob(
  db: DB,
  jobId: string,
  errorCode: string,
  errorMessage: string,
  traceId?: string,
  extraEventPayload?: Record<string, unknown>,
): Promise<void> {
  const job = await getJobById(db, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  if (!canTransition(job.status, 'failed')) {
    throw new Error(`Cannot transition job ${jobId} from ${job.status} to failed`);
  }

  await updateJobStatus(db, jobId, 'failed', errorCode, errorMessage, job.status);
  await createJobEvent(db, jobId, 'failed', { errorCode, errorMessage, ...(extraEventPayload ?? {}) }, traceId);
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
    expectedStatus: job.status,
  });
}

export async function reconcileJobOutputs(
  db: DB,
  jobId: string,
  options: ReconcileJobOutputsOptions = {},
): Promise<ReconcileJobOutputsResult> {
  const job = await getJobById(db, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const outputPrefix = `outputs/${jobId}/`;
  const blob = options.blob ?? new BlobStorage();
  const assets = await getJobAssets(db, jobId);
  const persistedOutputPaths = assets
    .filter((asset) => asset.kind === 'output')
    .map((asset) => asset.blob_path);
  const persistedPathSet = new Set(persistedOutputPaths);
  const blobOutputPaths = (await blob.listBlobs(outputPrefix)).map((entry) => entry.path);
  const orphanedOutputPaths = blobOutputPaths.filter((path) => !persistedPathSet.has(path));
  const deletedOutputPaths: string[] = [];
  const deleteFailures: Array<{ blobPath: string; errorMessage: string }> = [];

  if (options.deleteOrphans) {
    for (const blobPath of orphanedOutputPaths) {
      try {
        await blob.deleteBlob(blobPath);
        deletedOutputPaths.push(blobPath);
      } catch (err) {
        deleteFailures.push({
          blobPath,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return {
    jobId,
    outputPrefix,
    persistedOutputPaths,
    blobOutputPaths,
    orphanedOutputPaths,
    deletedOutputPaths,
    deleteFailures,
  };
}
