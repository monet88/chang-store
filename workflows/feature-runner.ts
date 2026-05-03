import type { DB, JobRecord } from '../server/db';
import { getJobById, updateJobStatus } from '../server/db';
import { createWorkflowContext, withErrorHandling, type WorkflowContext } from './helpers';
import { transitionStatus } from '../server/jobs';
import { completeJob, failJob, partialJob } from '../server/adapters/base-adapter';
import { runCanary } from './canary';

interface FeatureAdapter {
  feature: string;
  validate: (payload: unknown) => unknown;
  mapInput: (payload: unknown) => Record<string, unknown>;
  mapOutput: (result: Record<string, unknown>) => Record<string, unknown>;
}

export interface RunJobResult {
  status: JobRecord['status'];
  assets?: Array<{ blobPath: string; mimeType: string }>;
  errorCode?: string;
  errorMessage?: string;
}

interface CleanupFailure {
  blobPath: string;
  errorMessage: string;
}

async function cleanupUploadedBlobs(
  ctx: WorkflowContext,
  assets: Array<{ blobPath: string; mimeType: string }>,
): Promise<CleanupFailure[]> {
  const results = await Promise.all(assets.map(async ({ blobPath }) => {
    try {
      await ctx.blob.deleteBlob(blobPath);
      return null;
    } catch (cleanupError) {
      console.error(`[RUNNER] Failed to clean up blob ${blobPath}:`, cleanupError);
      return {
        blobPath,
        errorMessage: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      } satisfies CleanupFailure;
    }
  }));

  return results.filter((result): result is CleanupFailure => result !== null);
}

function jobRecordToRunResult(job: JobRecord): RunJobResult {
  const result: RunJobResult = { status: job.status };
  if (job.error_code) {
    result.errorCode = job.error_code;
  }
  if (job.error_message) {
    result.errorMessage = job.error_message;
  }
  return result;
}

async function getCurrentJobResult(db: DB, jobId: string): Promise<RunJobResult | null> {
  const currentJob = await getJobById(db, jobId);
  return currentJob ? jobRecordToRunResult(currentJob) : null;
}

/**
 * Run a feature job through the durable execution pipeline.
 * This is the main entry point for both Workflow and Inngest paths.
 */
export async function runFeatureJob(
  db: DB,
  job: JobRecord,
  adapter: FeatureAdapter,
  executeStep: (ctx: WorkflowContext, input: Record<string, unknown>, feature: string) => Promise<{ results: Record<string, unknown>[] }>,
  traceId: string,
): Promise<RunJobResult> {
  const ctx = createWorkflowContext(db, traceId);

  try {
    const { status: newStatus } = transitionStatus(job, 'running');
    try {
      await updateJobStatus(db, job.id, newStatus, undefined, undefined, job.status);
    } catch (transitionError) {
      const currentResult = await getCurrentJobResult(db, job.id);
      if (currentResult) {
        return currentResult;
      }
      throw transitionError;
    }

    const validatedPayload = adapter.validate(job.input_payload_json);
    const input = adapter.mapInput(validatedPayload);
    const { results } = await withErrorHandling(ctx, job.id, 'gemini_execute', () =>
      executeStep(ctx, input, adapter.feature),
    );

    if (results.length === 0) {
      await failJob(db, job.id, 'NO_RESULTS', 'Gemini returned no results', traceId);
      return { status: 'failed', errorCode: 'NO_RESULTS', errorMessage: 'Gemini returned no results' };
    }

    const assets: Array<{ blobPath: string; mimeType: string }> = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.error) continue;

      const base64 = r.base64 as string | undefined;
      const mimeType = (r.mimeType as string) || 'image/png';
      if (base64) {
        const blobPath = `outputs/${job.id}/${i}.png`;
        const buffer = Buffer.from(base64, 'base64');
        await ctx.blob.storeFile(blobPath, buffer, mimeType);
        assets.push({ blobPath, mimeType });
      }
    }

    const failed = results.some(r => r.error);
    if (failed) {
      const succeeded = results.filter(r => !r.error);
      if (succeeded.length > 0) {
        const succeededAssets = assets.slice(0, succeeded.length);
        try {
          await partialJob(db, job.id, succeededAssets, 'PARTIAL_FAILURE', 'Some items failed', traceId);
        } catch (finalizeError) {
          const cleanupFailures = await cleanupUploadedBlobs(ctx, succeededAssets);
          throw {
            finalizeError,
            cleanupFailures,
          };
        }
        return { status: 'partial', assets: succeededAssets, errorCode: 'PARTIAL_FAILURE' };
      }
      await failJob(db, job.id, 'ALL_FAILED', 'All items failed', traceId);
      return { status: 'failed', errorCode: 'ALL_FAILED', errorMessage: 'All items failed' };
    }

    if (assets.length === 0) {
      await failJob(db, job.id, 'NO_ASSETS', 'No assets produced', traceId);
      return { status: 'failed', errorCode: 'NO_ASSETS', errorMessage: 'No assets produced' };
    }

    try {
      await completeJob(db, job.id, assets, traceId);
    } catch (finalizeError) {
      const cleanupFailures = await cleanupUploadedBlobs(ctx, assets);
      throw {
        finalizeError,
        cleanupFailures,
      };
    }
    return { status: 'completed', assets };
  } catch (err) {
    const wrapped = err as { finalizeError?: unknown; cleanupFailures?: CleanupFailure[] };
    const rootError = wrapped.finalizeError ?? err;
    const message = rootError instanceof Error ? rootError.message : String(rootError);
    const cleanupFailures = wrapped.cleanupFailures ?? [];
    const extraEventPayload = cleanupFailures.length > 0 ? { cleanupFailures } : undefined;
    try {
      await failJob(db, job.id, 'EXECUTION_FAILED', message, traceId, extraEventPayload);
    } catch (failError) {
      const currentResult = await getCurrentJobResult(db, job.id);
      if (currentResult?.status === 'completed' || currentResult?.status === 'partial' || currentResult?.status === 'failed') {
        return currentResult;
      }
      throw failError;
    }
    return { status: 'failed', errorCode: 'EXECUTION_FAILED', errorMessage: message };
  }
}

/**
 * Initialize the runner — runs canary gate first.
 * Returns which provider to use for job execution.
 */
export async function initializeRunner(): Promise<'vercel-workflow' | 'inngest-fallback'> {
  const canary = await runCanary();
  if (!canary.success) {
    console.error('[RUNNER] Canary failed:', canary.error);
    throw new Error(`Workflow canary failed: ${canary.error}. Set INNGEST_FALLBACK=true to use fallback.`);
  }
  console.log(`[RUNNER] Using provider: ${canary.provider} (canary: ${canary.duration}ms)`);
  return canary.provider;
}
