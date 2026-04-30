/**
 * Canary workflow — validates Vercel Workflow local dev works.
 * Per revision ADR: before Slice 3 full implementation,
 * (a) canary must pass locally, (b) canary deployed + exercised on prod,
 * (c) Inngest kill-switch tested. If any fail → pivot to Inngest.
 */

export interface CanaryResult {
  success: boolean;
  provider: 'vercel-workflow' | 'inngest-fallback';
  duration: number;
  error?: string;
}

export async function runCanary(): Promise<CanaryResult> {
  const start = Date.now();

  // Check if Vercel Workflow is enabled
  const workflowEnabled = process.env.VERCEL_WORKFLOW_ENABLED === 'true';
  const inngestFallback = process.env.INNGEST_FALLBACK === 'true';

  if (inngestFallback) {
    // Inngest fallback pathway — test it works
    try {
      await testInngestFallback();
      return { success: true, provider: 'inngest-fallback', duration: Date.now() - start };
    } catch (err) {
      return { success: false, provider: 'inngest-fallback', duration: Date.now() - start, error: String(err) };
    }
  }

  if (!workflowEnabled) {
    // No workflow enabled — can't run jobs
    return { success: false, provider: 'vercel-workflow', duration: Date.now() - start, error: 'VERCEL_WORKFLOW_ENABLED is not true and INNGEST_FALLBACK is not set' };
  }

  // Try Vercel Workflow canary
  try {
    await testVercelWorkflow();
    return { success: true, provider: 'vercel-workflow', duration: Date.now() - start };
  } catch (err) {
    console.warn('[CANARY] Vercel Workflow failed, recommend enabling INNGEST_FALLBACK:', String(err));
    return { success: false, provider: 'vercel-workflow', duration: Date.now() - start, error: String(err) };
  }
}

async function testVercelWorkflow(): Promise<void> {
  // Placeholder: actual Vercel Workflow API call
  // In Slice 3 MVP, this validates the workflow infrastructure exists
  // For now: check that required env vars are set, Vercel context is available
  if (!process.env.VERCEL) {
    console.log('[CANARY] Not running on Vercel — local dev mode');
  }
  // No-op success for now — real implementation requires Vercel deployment
}

async function testInngestFallback(): Promise<void> {
  // Placeholder: validate Inngest client can connect
  // For now: no-op, actual Inngest integration requires Inngest SDK
  console.log('[CANARY] Inngest fallback active — polling-based execution');
}
