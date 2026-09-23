import type { ImageEngineId } from '../types';

/**
 * Resolves concurrency for batch generation jobs.
 * Local Qwen is strictly serialized (max 1 concurrency) to prevent GPU VRAM exhaustion.
 */
export const resolveEngineConcurrency = (
  engineId: ImageEngineId | undefined,
  defaultConcurrency: number,
): number => (engineId === 'localQwen' ? 1 : defaultConcurrency);

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
