/**
 * Base URL validation for provider studios.
 *
 * Provider API keys are sent to whatever base URL the user configures, so an
 * attacker-controlled URL could exfiltrate the key. The app therefore warns
 * whenever the host is not a known first-party provider, but it accepts any
 * valid `http:` or `https:` URL so users can point Gemini and GPT Image
 * at arbitrary gateways, proxies, or IP-based endpoints.
 */

/** Known, trusted provider API hosts. */
export const ALLOWED_PROVIDER_HOSTS = ['api.x.ai', 'api.openai.com'] as const;

export type ProviderUrlValidationResult =
  | { status: 'allowed'; url: string; host: string }
  | { status: 'custom'; url: string; host: string }
  | { status: 'invalid'; reason: 'not-a-url' | 'empty' };

const normalizeHost = (host: string): string => {
  const lower = host.toLowerCase().replace(/^www\./, '');
  // URL.hostname returns IPv6 literals wrapped in `[...]`. Strip them so the
  // host string is consistent with IPv4 hostnames before private-range matching.
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return lower.slice(1, -1);
  }
  return lower;
};

/**
 * Validate a provider base URL.
 *
 * - `allowed`: HTTPS URL on a known provider host — safe to use silently.
 * - `custom`: valid HTTP(S) URL on any other host — caller must confirm with
 *   the user that the API key will be sent to this domain.
 * - `invalid`: empty or malformed URL — must be rejected.
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

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { status: 'invalid', reason: 'not-a-url' };
  }

  const host = normalizeHost(parsed.hostname);

  const isAllowed = (ALLOWED_PROVIDER_HOSTS as readonly string[]).some(
    (allowed) => host === allowed,
  );

  return isAllowed
    ? { status: 'allowed', url: trimmed, host }
    : { status: 'custom', url: trimmed, host };
}

/** Convenience guard: true when the URL is a valid HTTP(S) provider URL (allowed or custom). */
export function isUsableProviderBaseUrl(rawUrl: string): boolean {
  const result = validateProviderBaseUrl(rawUrl);
  return result.status === 'allowed' || result.status === 'custom';
}
