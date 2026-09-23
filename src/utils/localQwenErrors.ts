import { en } from '../locales/en';

export type LocalQwenErrorKind =
  | 'startup'
  | 'incompatible_health'
  | 'missing_model'
  | 'invalid_workflow'
  | 'cancellation'
  | 'oom'
  | 'unknown';

export interface ClassifiedLocalQwenError {
  kind: LocalQwenErrorKind;
  titleKey: string;
  suggestionKey: string;
  title: string;
  message: string;
  actionableSuggestion: string;
}

/**
 * Classifies an error from Local Qwen (ComfyUI) into an actionable category.
 *
 * Invariants:
 * - Local failures stay local and NEVER suggest or fall back to cloud providers.
 * - Always provides a concrete, actionable suggestion for the user.
 */
export const classifyLocalQwenError = (
  error: unknown,
  t?: (key: string) => string,
): ClassifiedLocalQwenError => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error || '');
  const lower = raw.toLowerCase();

  const resolve = (
    kind: LocalQwenErrorKind,
    titleKey: string,
    suggestionKey: string,
    fallbackTitle: string,
    fallbackSuggestion: string,
  ): ClassifiedLocalQwenError => ({
    kind,
    titleKey,
    suggestionKey,
    title: t ? t(titleKey) : fallbackTitle,
    message: raw,
    actionableSuggestion: t ? t(suggestionKey) : fallbackSuggestion,
  });

  const errs = en.studio.localQwenStatus.errors;

  // 1. Cancellation
  if (
    lower.includes('cancel') ||
    lower.includes('interrupted') ||
    lower.includes('abort')
  ) {
    return resolve(
      'cancellation',
      'studio.localQwenStatus.errors.cancellation.title',
      'studio.localQwenStatus.errors.cancellation.suggestion',
      errs.cancellation.title,
      errs.cancellation.suggestion,
    );
  }

  // 2. OOM (Out of Memory)
  if (
    lower.includes('out of memory') ||
    lower.includes('outofmemoryerror') ||
    lower.includes('cuda out of memory') ||
    lower.includes('allocation on device') ||
    (lower.includes('vram') && (lower.includes('full') || lower.includes('exceeded') || lower.includes('enough')))
  ) {
    return resolve(
      'oom',
      'studio.localQwenStatus.errors.oom.title',
      'studio.localQwenStatus.errors.oom.suggestion',
      errs.oom.title,
      errs.oom.suggestion,
    );
  }

  // 3. Missing Model
  if (
    (lower.includes('model') &&
      (lower.includes('not found') ||
        lower.includes('missing') ||
        lower.includes('filenotfound') ||
        lower.includes('does not exist') ||
        lower.includes('no such file'))) ||
    lower.includes('unetloadergguf') ||
    lower.includes('vaeloader') ||
    lower.includes('cliploader') ||
    lower.includes('qwen-image-2.1-q4_k_m.gguf') ||
    lower.includes('qwen3vl_8b_w4a8.safetensors') ||
    lower.includes('qwen_image_2.1_vae')
  ) {
    return resolve(
      'missing_model',
      'studio.localQwenStatus.errors.missingModel.title',
      'studio.localQwenStatus.errors.missingModel.suggestion',
      errs.missingModel.title,
      errs.missingModel.suggestion,
    );
  }

  // 4. Incompatible health / environment
  if (
    lower.includes('incompatible') ||
    lower.includes('custom node') ||
    lower.includes('comfyui-gguf') ||
    lower.includes('unsupported version') ||
    (lower.includes('system_stats') && lower.includes('failed'))
  ) {
    return resolve(
      'incompatible_health',
      'studio.localQwenStatus.errors.incompatibleHealth.title',
      'studio.localQwenStatus.errors.incompatibleHealth.suggestion',
      errs.incompatibleHealth.title,
      errs.incompatibleHealth.suggestion,
    );
  }

  // 5. Invalid workflow
  if (
    lower.includes('workflow') ||
    lower.includes('prompt rejected') ||
    lower.includes('value not in list') ||
    lower.includes('invalid node') ||
    lower.includes('textencodeqwenimage21') ||
    lower.includes('ksampler')
  ) {
    return resolve(
      'invalid_workflow',
      'studio.localQwenStatus.errors.invalidWorkflow.title',
      'studio.localQwenStatus.errors.invalidWorkflow.suggestion',
      errs.invalidWorkflow.title,
      errs.invalidWorkflow.suggestion,
    );
  }

  // 6. Startup
  if (
    lower.includes('directory not found') ||
    lower.includes('could not find comfyui') ||
    lower.includes('timed out waiting') ||
    lower.includes('exited prematurely') ||
    lower.includes('process error') ||
    lower.includes('spawn') ||
    lower.includes('econnrefused') ||
    lower.includes('failed to start') ||
    lower.includes('server is not running')
  ) {
    return resolve(
      'startup',
      'studio.localQwenStatus.errors.startup.title',
      'studio.localQwenStatus.errors.startup.suggestion',
      errs.startup.title,
      errs.startup.suggestion,
    );
  }

  return resolve(
    'unknown',
    'studio.localQwenStatus.errors.unknown.title',
    'studio.localQwenStatus.errors.unknown.suggestion',
    errs.unknown.title,
    errs.unknown.suggestion,
  );
};
