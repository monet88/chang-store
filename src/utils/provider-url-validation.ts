/**
 * Base URL validation for provider studios.
 *
 * Provider API keys are sent to whatever base URL the user configures, so an
 * attacker-controlled URL could exfiltrate the key. We allowlist known provider
 * domains, require HTTPS for anything else, and only allow `http:` when the
 * host is a private/loopback address (localhost, 127/8, RFC1918, link-local,
 * ULA). This lets developers point at local proxies without leaking bearer
 * tokens over public HTTP.
 */

/** Known, trusted provider API hosts. */
export const ALLOWED_PROVIDER_HOSTS = ['api.x.ai', 'api.openai.com'] as const;

export type ProviderUrlValidationResult =
  | { status: 'allowed'; url: string; host: string }
  | { status: 'custom'; url: string; host: string }
  | { status: 'invalid'; reason: 'not-a-url' | 'empty' | 'insecure-http' };

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
 * Identify hosts that are safe to reach over plain HTTP because the traffic
 * cannot leave the developer's machine or local network. Loopback names,
 * `*.local` mDNS hostnames, IPv4 loopback (127/8) and RFC1918 ranges
 * (10/8, 172.16/12, 192.168/16), IPv4 link-local (169.254/16), IPv6
 * loopback (`::1`), IPv6 link-local (`fe80::/10`), and IPv6 ULA (`fc00::/7`)
 * all qualify. Everything else (public DNS hostnames, public IPs) does not.
 */
function isPrivateOrLoopbackHost(host: string): boolean {
  if (host === 'localhost' || host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.localhost')) {
    return true;
  }

  // IPv6 literal — URL.hostname strips the surrounding `[]`.
  if (host.includes(':')) {
    const lower = host.toLowerCase();
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // link-local fe80::/10
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // ULA fc00::/7
    return false;
  }

  // IPv4 literal — four dotted octets, each 0-255.
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;
  const octets = ipv4Match.slice(1).map((part) => Number(part));
  if (octets.some((value) => value < 0 || value > 255)) return false;
  const [a, b] = octets;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

/**
 * Validate a provider base URL.
 *
 * - `allowed`: HTTPS URL on a known provider host — safe to use silently.
 * - `custom`: valid URL on an unknown host that meets the transport policy
 *   (HTTPS, or HTTP only on private/loopback addresses) — caller must confirm
 *   with the user that the API key will be sent to this domain.
 * - `invalid`: empty, malformed, or insecure (`http:` on a public host) URL —
 *   must be rejected.
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

  // HTTP is only acceptable when the host cannot leak the bearer token over
  // the public internet. Public HTTP hosts are rejected outright.
  if (parsed.protocol === 'http:' && !isPrivateOrLoopbackHost(host)) {
    return { status: 'invalid', reason: 'insecure-http' };
  }

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
