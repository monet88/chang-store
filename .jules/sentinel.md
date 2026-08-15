## 2026-06-11 - Timing Attack Vulnerability in Gateway Auth
**Vulnerability:** The `constantTimeEqual` function in `gateway/src/auth/gateway-auth.ts` used an early return if string lengths mismatched, exposing the API key length to timing attacks.
**Learning:** Even when using `timingSafeEqual`, early returns for length checks negate the constant-time protection by leaking the secret's length.
**Prevention:** Always hash both strings to a fixed length (e.g., via SHA-256) before using `timingSafeEqual` to guarantee a truly constant-time comparison.

## 2026-06-12 - ReDoS and Memory DoS in Data URL Parsing
**Vulnerability:** Gateway image endpoints parsed massive base64 image data URLs using `.match(/^data:(.+?);base64,([A-Za-z0-9+/=\s]+)$/i)`. This regex is vulnerable to ReDoS due to backtracking on invalid base64 payloads, blocking the event loop.
**Learning:** Using regex on multi-megabyte strings is dangerous. Furthermore, attempting to replace it with `value.toLowerCase().startsWith(...)` introduces a memory DoS by duplicating the entire multi-megabyte string just to check the prefix.
**Prevention:** For large payloads, always use bounded string operations (`value.substring(0, 5).toLowerCase()`) and avoid regex validation of the entire string body. Instead, validate character constraints using an explicit iteration over the string segment.

## 2026-06-12 - Weak Random ID Generation
**Vulnerability:** The codebase was using `Math.random()` and `Date.now()` combined (e.g., `Math.random().toString(36).slice(2, 9)`) to generate unique IDs for uploaded files, queue items, and downloaded files. This is cryptographically insecure and susceptible to collisions and predictability.
**Learning:** `Math.random()` is not suitable for generating secure unique identifiers, even when combined with timestamps.
**Prevention:** Always use the native, cryptographically secure `crypto.randomUUID()` when generating unique identifiers in the application.

## 2026-06-12 - Sensitive Data Autofill Prevention
**Vulnerability:** Input fields for sensitive API keys were using `autoComplete="off"`, which modern browsers and password managers often ignore, potentially causing them to unexpectedly save or autofill credentials.
**Learning:** `autoComplete="off"` is no longer respected by many modern browsers for password/credential fields to encourage password manager usage. This is unsafe for application-specific API keys that shouldn't be managed like user passwords.
**Prevention:** For sensitive configuration inputs like API keys, always use `autoComplete="new-password"` instead of `autoComplete="off"` to reliably prevent browsers and password managers from capturing or autofilling them.
