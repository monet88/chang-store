/** Maximum allowed prompt length in characters. */
export const MAX_PROMPT_LENGTH = 10_000;

/**
 * Sanitize and bound a user-supplied prompt before it reaches a provider API.
 *
 * - Strips null bytes and control characters (except newlines/tabs).
 * - Trims surrounding whitespace.
 * - Throws when the (trimmed) prompt is empty or exceeds {@link MAX_PROMPT_LENGTH}.
 *
 * Error messages use i18n keys so hooks can surface them via `getErrorMessage`.
 */
export function validatePrompt(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('error.provider.prompt.empty');
  }

  // Remove control characters except tab (\u0009) and newline (\u000A).
  // eslint-disable-next-line no-control-regex
  const stripped = input.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
  const trimmed = stripped.trim();

  if (trimmed.length === 0) {
    throw new Error('error.provider.prompt.empty');
  }

  if (trimmed.length > MAX_PROMPT_LENGTH) {
    throw new Error('error.provider.prompt.tooLong');
  }

  return trimmed;
}
