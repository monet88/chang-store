/**
 * Base URL validation for provider studios.
 *
 * Provider API keys are sent to whatever base URL the user configures, so an
 * attacker-controlled URL could exfiltrate the key. We allowlist known provider
 * domains and require HTTPS + explicit confirmation for anything else.
 */

/** Known, trusted provider API hosts. */
export const ALLOWED_PROVIDER_HOSTS = ['api.x.ai', 'api.openai.com'] as const;

export type ProviderUrlValidationResult =
  | { status: 'allowed'; url: string; host: string }
  | { status: 'custom'; url: string; host: string }
  | { status: 'invalid'; reason: 'not-a-url' | 'not-https' | 'empty' };

const normalizeHost = (host: string): string => host.toLowerCase().replace(/^www\./, '');

/**
 * Validate a provider base URL.
 *
 * - `allowed`: HTTPS URL on a known provider host — safe to use silently.
 * - `custom`: valid HTTPS URL on an unknown host — caller must confirm with the
 *   user that the API key will be sent to this domain.
 * - `invalid`: empty, malformed, or non-HTTPS URL — must be rejected.
 */
export function validateProviderBaseUrl(rawUrl: string): ProviderUrlValidationResult {
  const trimmed = (rawUrl ?? '').trim();
  if (trimmed.length === 0) {
    return { status: 'invalid', reason: 'empty' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { status: 'invalid', reason: 'not-a-url' };
  }

  if (parsed.protocol !== 'https:') {
    return { status: 'invalid', reason: 'not-https' };
  }

  const host = normalizeHost(parsed.hostname);
  const isAllowed = (ALLOWED_PROVIDER_HOSTS as readonly string[]).some(
    (allowed) => host === allowed,
  );

  return isAllowed
    ? { status: 'allowed', url: trimmed, host }
    : { status: 'custom', url: trimmed, host };
}

/** Convenience guard: true when the URL is a valid HTTPS provider URL (allowed or custom). */
export function isUsableProviderBaseUrl(rawUrl: string): boolean {
  const result = validateProviderBaseUrl(rawUrl);
  return result.status === 'allowed' || result.status === 'custom';
}
