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
export const classifyLocalQwenError = (error: unknown): ClassifiedLocalQwenError => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error || '');
  const lower = raw.toLowerCase();

  // 1. Cancellation
  if (
    lower.includes('cancel') ||
    lower.includes('interrupted') ||
    lower.includes('abort')
  ) {
    return {
      kind: 'cancellation',
      title: 'Generation Cancelled',
      message: raw,
      actionableSuggestion: 'Generation was cancelled. You can retry whenever you are ready.',
    };
  }

  // 2. OOM (Out of Memory)
  if (
    lower.includes('out of memory') ||
    lower.includes('outofmemoryerror') ||
    lower.includes('cuda out of memory') ||
    lower.includes('allocation on device') ||
    (lower.includes('vram') && (lower.includes('full') || lower.includes('exceeded') || lower.includes('enough')))
  ) {
    return {
      kind: 'oom',
      title: 'GPU Out of Memory',
      message: raw,
      actionableSuggestion:
        'Your GPU ran out of VRAM. Try reducing the resolution to 512 in Settings or closing other GPU-intensive applications.',
    };
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
    return {
      kind: 'missing_model',
      title: 'Missing Model Files',
      message: raw,
      actionableSuggestion:
        'Required model files are missing from ComfyUI/models/. Check your installation or update the ComfyUI path in Settings.',
    };
  }

  // 4. Incompatible health / environment
  if (
    lower.includes('incompatible') ||
    lower.includes('custom node') ||
    lower.includes('comfyui-gguf') ||
    lower.includes('unsupported version') ||
    (lower.includes('system_stats') && lower.includes('failed'))
  ) {
    return {
      kind: 'incompatible_health',
      title: 'Incompatible ComfyUI Environment',
      message: raw,
      actionableSuggestion:
        'ComfyUI is missing required custom nodes (e.g. ComfyUI-GGUF). Ensure your ComfyUI portable environment is properly configured.',
    };
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
    return {
      kind: 'invalid_workflow',
      title: 'Invalid Workflow',
      message: raw,
      actionableSuggestion:
        'The ComfyUI workflow could not be validated. Check your node settings or update ComfyUI custom nodes.',
    };
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
    return {
      kind: 'startup',
      title: 'ComfyUI Startup Error',
      message: raw,
      actionableSuggestion:
        'Could not start or connect to local ComfyUI. Check the ComfyUI folder path in Settings and try again.',
    };
  }

  return {
    kind: 'unknown',
    title: 'Local Qwen Error',
    message: raw,
    actionableSuggestion:
      'An unexpected error occurred in local ComfyUI. Review ComfyUI logs or retry the generation.',
  };
};
