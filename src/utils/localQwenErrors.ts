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
  let raw = '';
  if (error instanceof Error) {
    raw = error.message;
  } else if (typeof error === 'string') {
    raw = error;
  } else {
    try {
      raw = JSON.stringify(error ?? '');
    } catch {
      raw = String(error ?? 'unknown');
    }
  }
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

  // 3. Missing Model Files (model filename or models/ path absent)
  const hasModelFilePattern =
    lower.includes('.gguf') ||
    lower.includes('.safetensors') ||
    lower.includes('qwen_image_2.1_vae') ||
    lower.includes('models/diffusion_models') ||
    lower.includes('models/text_encoders') ||
    lower.includes('models/vae') ||
    (lower.includes('models/') && (lower.includes('not found') || lower.includes('missing') || lower.includes('filenotfound') || lower.includes('no such file'))) ||
    (lower.includes('model') && (lower.includes('not found') || lower.includes('missing') || lower.includes('filenotfound') || lower.includes('does not exist') || lower.includes('no such file')) && !lower.includes('node'));

  const hasMissingPattern =
    lower.includes('not found') ||
    lower.includes('missing') ||
    lower.includes('filenotfound') ||
    lower.includes('does not exist') ||
    lower.includes('no such file');

  if (hasModelFilePattern && hasMissingPattern) {
    return resolve(
      'missing_model',
      'studio.localQwenStatus.errors.missingModel.title',
      'studio.localQwenStatus.errors.missingModel.suggestion',
      errs.missingModel.title,
      errs.missingModel.suggestion,
    );
  }

  // 4. Incompatible health / environment (Missing Node Types or Custom Nodes)
  const isMissingNode =
    lower.includes('incompatible') ||
    lower.includes('custom node') ||
    lower.includes('comfyui-gguf') ||
    lower.includes('unsupported version') ||
    (lower.includes('system_stats') && lower.includes('failed')) ||
    (lower.includes('node') && (lower.includes('not found') || lower.includes('missing') || lower.includes('invalid') || lower.includes('cannot find') || lower.includes('unknown'))) ||
    lower.includes('unetloadergguf') ||
    lower.includes('textencodeqwenimage21');

  if (isMissingNode) {
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
