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
  executeStep: (ctx: WorkflowContext, input: Record<string, unknown>) => Promise<{ results: Record<string, unknown>[] }>,
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
      executeStep(ctx, input),
    );

    // Determine outcome
    if (results.length === 0) {
      await failJob(db, job.id, 'NO_RESULTS', 'Gemini returned no results', traceId);
      return { status: 'failed', errorCode: 'NO_RESULTS', errorMessage: 'Gemini returned no results' };
    }

    // Map results to assets
    const assets = results.map((r, i) => ({
      blobPath: `outputs/${job.id}/${i}.png`,
      mimeType: 'image/png',
    }));

    // Check for partial success (if batch had failures)
    const failed = results.some(r => r.error);
    if (failed) {
      const succeeded = results.filter(r => !r.error);
      const succeededAssets = succeeded.map((r, i) => ({
        blobPath: `outputs/${job.id}/${i}.png`,
        mimeType: 'image/png',
      }));
      await partialJob(db, job.id, succeededAssets, 'PARTIAL_FAILURE', 'Some items failed', traceId);
      return { status: 'partial', assets: succeededAssets, errorCode: 'PARTIAL_FAILURE' };
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
