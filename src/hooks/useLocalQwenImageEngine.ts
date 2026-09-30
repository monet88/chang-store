import { useMemo } from 'react';
import type { ImageEngine } from '../contexts/ImageEngineContext';
import {
  withLocalQwenLock,
  cancelQueuedLocalQwenJobs,
} from '../services/providers/local-qwen/localQwenLock';
import { LocalQwenImageDriverAdapter } from '../services/providers/local-qwen/LocalQwenImageDriverAdapter';
import type { ImageDriver } from '../services/providers/ImageDriver';
import { createLegacyDriverBridge } from '../contexts/ImageEngineContext';

export { cancelQueuedLocalQwenJobs };
export const runSerializedLocalQwenJob = withLocalQwenLock;

/**
 * Image Engine for Local Qwen running on local ComfyUI.
 *
 * Invariants:
 * - Desktop only.
 * - Max 1 active generation at a time (strictly serialized via localQwenLock).
 * - Snapshot settings when job starts; subsequent mutations don't affect running job.
 * - Never falls back to cloud providers on failure.
 * - No auto-upscale; results remain at configured resolution.
 */
export const useLocalQwenImageEngine = (): ImageEngine => {
  const driver = useMemo<ImageDriver>(() => new LocalQwenImageDriverAdapter(), []);
  const legacyBridge = useMemo(() => createLegacyDriverBridge(driver, 'qwen-image-2.1'), [driver]);

  return useMemo<ImageEngine>(() => {
    return {
      id: 'localQwen',
      model: 'qwen-image-2.1',
      driver,
      generate: (job) => driver.generate(job),
      generateOne: (job) => driver.generateOne(job),
      upscale: (job) => driver.upscale(job),
      editImage: legacyBridge.editImage,
      upscaleImage: legacyBridge.upscaleImage,
      createImageChatSession: null,
      modelOptions: null,
      setModel: null,
      noSelectableModel: false,
      options: null,
    };
  }, [driver, legacyBridge]);
};

