import type { ImageEngineId } from '../types';

export const DEFAULT_MAX_CONCURRENCY = 10;

/**
 * Resolves concurrency for batch generation jobs.
 * Local Qwen is strictly serialized (max 1 concurrency) to prevent GPU VRAM exhaustion.
 * Cloud engines (Gemini, GPT) scale up to the number of jobs, bounded by maxCap (default 10).
 */
export const resolveEngineConcurrency = (
  engineId: ImageEngineId | undefined,
  requestedCount: number,
  maxCap: number = DEFAULT_MAX_CONCURRENCY,
): number => {
  if (engineId === 'localQwen') return 1;
  const count = Math.max(1, requestedCount);
  return Math.min(count, maxCap);
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
