import type { ImageEngineId, ImageFile } from '../../../types';
import {
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type RecordedJob,
  StudioDriverError,
  isStudioDriverError,
} from '../ImageDriver';
import { withLocalQwenLock } from './localQwenLock';
import {
  snapshotLocalQwenSettings,
  loadLocalQwenSettings,
} from '../../../config/localQwenSettings';
import {
  getDesktopLocalQwenApi,
  isFaceSwapRefusal,
  LOCAL_QWEN_UNAVAILABLE_MESSAGE,
} from '../../../platform/desktopLocalQwen';
import { classifyLocalQwenError } from '../../../utils/localQwenErrors';
import type { LocalQwenWorkflow } from '../../../utils/engineDispatch';

export const FACE_SWAP_LORA_NAME = 'bfs_head_v1.1_qwen_2.1.safetensors';

/**
 * Maps any error from Local Qwen (ComfyUI / desktop bridge) to a normalized StudioDriverError.
 */
export const mapLocalQwenErrorToStudioDriverError = (error: unknown): StudioDriverError => {
  if (isStudioDriverError(error)) {
    return error;
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error ?? 'Unknown local Qwen error');

  const lower = rawMessage.toLowerCase();

  // Desktop bridge unavailable / non-desktop runtime
  if (
    rawMessage === LOCAL_QWEN_UNAVAILABLE_MESSAGE ||
    lower.includes('only available in the desktop app') ||
    lower.includes('requires desktop app runtime')
  ) {
    return new StudioDriverError('gateway_down', rawMessage, {
      status: 503,
      retryable: false,
      cause: error,
    });
  }

  const classified = classifyLocalQwenError(error);

  switch (classified.kind) {
    case 'oom':
    case 'missing_model':
      return new StudioDriverError('hardware_error', rawMessage, {
        retryable: false,
        cause: error,
      });

    case 'cancellation':
      return new StudioDriverError('cancelled', rawMessage, {
        retryable: false,
        cause: error,
      });

    case 'startup':
    case 'incompatible_health':
      return new StudioDriverError('gateway_down', rawMessage, {
        status: 503,
        retryable: false,
        cause: error,
      });

    case 'invalid_workflow':
      return new StudioDriverError('unknown', rawMessage, {
        status: 400,
        retryable: false,
        cause: error,
      });

    case 'unknown':
    default:
      return new StudioDriverError('unknown', rawMessage, {
        retryable: false,
        cause: error,
      });
  }
};

/**
 * ImageDriver implementation for Local Qwen running via desktop ComfyUI bridge.
 *
 * Invariants:
 * - Desktop only via Electron IPC or Vite dev bridge.
 * - Single-flight execution strictly serialized across generate and upscale via localQwenLock.
 * - Snapshot settings when job starts; subsequent mutations don't affect running job.
 * - FaceSwap LoRA auto-injection: auto-inject strictly when workflow === 'identity-transfer' && !isFaceSwapRefusal(prompt).
 * - Refusal phrases (English/Vietnamese) outrank workflow and force standard mode.
 * - Local Qwen Upscale Invariant: upscale is strictly local, manual only, never automatic, never routed to cloud.
 * - Hardware fatal errors (CUDA OOM, missing weights) are non-retriable.
 */
export class LocalQwenImageDriverAdapter implements ImageDriver {
  readonly id: ImageEngineId = 'localQwen';
  private recordedJobs: (GenerateJob | UpscaleJob)[] = [];

  constructor() {
    this.generate = this.generate.bind(this);
    this.generateOne = this.generateOne.bind(this);
    this.upscale = this.upscale.bind(this);
  }

  getRecordedJobs(): RecordedJob[] {
    return [...this.recordedJobs] as RecordedJob[];
  }

  clearRecordedJobs(): void {
    this.recordedJobs = [];
  }

  async generate(job: GenerateJob): Promise<ImageFile[]> {
    return withLocalQwenLock(async () => {
      // 1. Immediate pre-abort check
      if (job.signal?.aborted) {
        throw new StudioDriverError('cancelled', 'Local Qwen generation was cancelled.', {
          retryable: false,
          cause: job.signal.reason,
        });
      }

      // 2. Snapshot settings for this job
      const settings = snapshotLocalQwenSettings();

      // 3. FaceSwap LoRA Auto-Injection Guard & Refusal Precedence
      const isRefusal = isFaceSwapRefusal(job.prompt);
      const shouldAutoInject = job.workflow === 'identity-transfer' && !isRefusal;

      let loraName: string | undefined;
      if (isRefusal) {
        loraName = undefined;
      } else if (job.injectedLora) {
        loraName = job.injectedLora;
      } else if (shouldAutoInject) {
        loraName = FACE_SWAP_LORA_NAME;
      }

      const effectiveWorkflow: LocalQwenWorkflow =
        job.workflow === 'identity-transfer' && !isRefusal
          ? 'identity-transfer'
          : 'standard';

      // 4. Record job for history / test harness with execution metadata (preserving caller immutability)
      this.recordedJobs.push({
        ...job,
        injectedLora: loraName,
      });

      // 5. Notify initial progress
      job.onProgress?.('LocalQwen: initializing generation pipeline...');

      // 6. Acquire desktop bridge
      const desktopApi = getDesktopLocalQwenApi();
      if (!desktopApi) {
        throw new StudioDriverError('gateway_down', LOCAL_QWEN_UNAVAILABLE_MESSAGE, {
          status: 503,
          retryable: false,
        });
      }

      // 7. Setup cancellation handler
      const abortHandler = () => {
        void desktopApi.cancelJob().catch(() => {});
      };
      job.signal?.addEventListener('abort', abortHandler, { once: true });

      try {
        // 8. Ensure ComfyUI server is running
        const statusRes = await desktopApi.getStatus();
        if (job.signal?.aborted) {
          throw new StudioDriverError('cancelled', 'Local Qwen generation was cancelled.', {
            retryable: false,
            cause: job.signal.reason,
          });
        }

        if (statusRes?.ok && statusRes.value.state !== 'ready' && statusRes.value.state !== 'generating') {
          const configuredPath = settings.comfyUiPath || loadLocalQwenSettings().comfyUiPath || undefined;
          const startRes = await desktopApi.startServer(configuredPath);
          if (job.signal?.aborted) {
            throw new StudioDriverError('cancelled', 'Local Qwen generation was cancelled.', {
              retryable: false,
              cause: job.signal.reason,
            });
          }
          if (startRes?.ok === false) {
            throw new Error(startRes.error?.message || 'Failed to auto-start local ComfyUI server.');
          }
        }

        // 9. Extract images from job.images or job.references
        const images: Array<{ base64: string; mimeType: string }> = [];
        if (job.images && job.images.length > 0) {
          for (const img of job.images) {
            images.push({ base64: img.base64, mimeType: img.mimeType || 'image/png' });
          }
        } else if (job.references && job.references.length > 0) {
          for (const ref of job.references) {
            images.push({ base64: ref.image.base64, mimeType: ref.image.mimeType || 'image/png' });
          }
        }

        // 10. Execute generation through bridge
        job.onProgress?.('LocalQwen: executing ComfyUI workflow...');

        const count = Math.max(1, job.count ?? 1);
        const results: ImageFile[] = [];

        for (let i = 0; i < count; i++) {
          if (job.signal?.aborted) {
            throw new StudioDriverError('cancelled', 'Local Qwen generation was cancelled.', {
              retryable: false,
              cause: job.signal.reason,
            });
          }

          const res = await desktopApi.generateImage({
            prompt: job.prompt,
            negativePrompt: job.negativePrompt,
            images: images.length > 0 ? images : undefined,
            resolution: settings.resolution,
            steps: settings.steps,
            cfg: settings.cfg,
            sampler: settings.sampler,
            scheduler: settings.scheduler,
            workflow: effectiveWorkflow,
            loraName,
          });

          if (job.signal?.aborted) {
            throw new StudioDriverError('cancelled', 'Local Qwen generation was cancelled.', {
              retryable: false,
              cause: job.signal.reason,
            });
          }

          if (res.ok === false) {
            throw new Error(res.error?.message || 'Local Qwen generation failed.');
          }

          if (!res.value?.image) {
            throw new Error('Local Qwen generation returned empty image response.');
          }

          results.push({
            base64: res.value.image.base64,
            mimeType: res.value.image.mimeType || 'image/png',
          });
        }

        job.onProgress?.('LocalQwen: generation completed.');
        return results;
      } catch (err) {
        throw mapLocalQwenErrorToStudioDriverError(err);
      } finally {
        job.signal?.removeEventListener('abort', abortHandler);
      }
    }, { signal: job.signal });
  }

  async generateOne(job: GenerateJob): Promise<ImageFile> {
    const results = await this.generate({ ...job, count: 1 });
    if (!results || results.length === 0) {
      throw new StudioDriverError('unknown', 'No image returned from Local Qwen generation', { retryable: false });
    }
    return results[0];
  }

  async upscale(job: UpscaleJob): Promise<ImageFile> {
    return withLocalQwenLock(async () => {
      // 1. Immediate pre-abort check
      if (job.signal?.aborted) {
        throw new StudioDriverError('cancelled', 'Local Qwen upscale aborted', {
          retryable: false,
          cause: job.signal.reason,
        });
      }

      // 2. Record upscale job
      this.recordedJobs.push({ ...job });

      // 3. Notify progress
      const quality = job.quality || '2K';
      job.onProgress?.(`LocalQwen: running local ESRGAN upscale with ComfyUI (${quality})...`);

      // 4. Verify desktop bridge availability
      const desktopApi = getDesktopLocalQwenApi();
      if (!desktopApi?.upscaleImage) {
        throw new StudioDriverError(
          'gateway_down',
          'Local Qwen upscale requires desktop app runtime or active dev bridge.',
          { status: 503, retryable: false }
        );
      }

      // 5. Setup abort handler
      const abortHandler = () => {
        void desktopApi.cancelJob?.().catch(() => {});
      };
      job.signal?.addEventListener('abort', abortHandler, { once: true });

      try {
        const scale = job.quality === '4K' ? 4 : 2;
        const res = await desktopApi.upscaleImage({
          image: job.image.base64,
          scale,
        });

        if (job.signal?.aborted) {
          throw new StudioDriverError('cancelled', 'Local Qwen upscale aborted', {
            retryable: false,
            cause: job.signal.reason,
          });
        }

        if (res.ok === false) {
          throw new Error(res.error?.message || 'Local Qwen upscale failed');
        }

        if (!res.value?.image) {
          throw new Error('Local Qwen upscale returned empty response');
        }

        job.onProgress?.('LocalQwen: upscale completed.');

        return {
          base64: res.value.image,
          mimeType: res.value.mimeType || job.image.mimeType || 'image/png',
        };
      } catch (err) {
        throw mapLocalQwenErrorToStudioDriverError(err);
      } finally {
        job.signal?.removeEventListener('abort', abortHandler);
      }
    }, { signal: job.signal });
  }
}
