import type { ImageEngineId } from '../types';

export const DEFAULT_MAX_CONCURRENCY = 10;

/**
 * Workflow routing hint shared by every image-engine call site. It lives with
 * the dispatch rules (not with one engine's params type) because it only ever
 * describes how dispatch should route a job, never how an engine renders it.
 */
export type LocalQwenWorkflow = 'identity-transfer' | 'standard';

/**
 * Resolves concurrency for batch generation jobs.
 * Local Qwen is strictly serialized (max 1 concurrency) to prevent GPU VRAM exhaustion.
 * Cloud engines (Gemini, GPT) scale up to the number of jobs, bounded by
 * `DEFAULT_MAX_CONCURRENCY`.
 */
export const resolveEngineConcurrency = (
  engineId: ImageEngineId | undefined,
  requestedCount: number,
): number => {
  if (engineId === 'localQwen') return 1;
  const count = Math.max(1, requestedCount);
  return Math.min(count, DEFAULT_MAX_CONCURRENCY);
};

/**
 * Dispatches an operation based on active image engine ID.
 */
export const dispatchByEngine = <T>(
  engineId: ImageEngineId | undefined,
  handlers: {
    localQwen: () => T;
    gptImage: () => T;
    gemini: () => T;
  },
): T => {
  if (engineId === 'localQwen') return handlers.localQwen();
  if (engineId === 'gptImage') return handlers.gptImage();
  return handlers.gemini();
};
