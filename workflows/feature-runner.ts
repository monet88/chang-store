import type { DB, JobRecord } from '../server/db';
import { updateJobStatus } from '../server/db';
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
  status: 'completed' | 'failed' | 'partial';
  assets?: Array<{ blobPath: string; mimeType: string }>;
  errorCode?: string;
  errorMessage?: string;
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
    // Transition to running
    const { status: newStatus } = transitionStatus(job, 'running');
    await updateJobStatus(db, job.id, newStatus);

    // Execute the Gemini step
    const input = adapter.mapInput(job.input_payload_json);
    const { results } = await withErrorHandling(ctx, job.id, 'gemini_execute', () =>
      executeStep(ctx, input, adapter.feature),
    );

    // Determine outcome
    if (results.length === 0) {
      await failJob(db, job.id, 'NO_RESULTS', 'Gemini returned no results', traceId);
      return { status: 'failed', errorCode: 'NO_RESULTS', errorMessage: 'Gemini returned no results' };
    }

    // Upload result images to Blob storage
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

    // Check for partial success
    const failed = results.some(r => r.error);
    if (failed) {
      const succeeded = results.filter(r => !r.error);
      if (succeeded.length > 0) {
        const succeededAssets = assets.slice(0, succeeded.length);
        await partialJob(db, job.id, succeededAssets, 'PARTIAL_FAILURE', 'Some items failed', traceId);
        return { status: 'partial', assets: succeededAssets, errorCode: 'PARTIAL_FAILURE' };
      }
      await failJob(db, job.id, 'ALL_FAILED', 'All items failed', traceId);
      return { status: 'failed', errorCode: 'ALL_FAILED', errorMessage: 'All items failed' };
    }

    if (assets.length === 0) {
      await failJob(db, job.id, 'NO_ASSETS', 'No assets produced', traceId);
      return { status: 'failed', errorCode: 'NO_ASSETS', errorMessage: 'No assets produced' };
    }

    await completeJob(db, job.id, assets, traceId);
    return { status: 'completed', assets };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(db, job.id, 'EXECUTION_FAILED', message, traceId);
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
