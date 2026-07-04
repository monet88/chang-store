## 2026-06-11 - Timing Attack Vulnerability in Gateway Auth
**Vulnerability:** The `constantTimeEqual` function in `gateway/src/auth/gateway-auth.ts` used an early return if string lengths mismatched, exposing the API key length to timing attacks.
**Learning:** Even when using `timingSafeEqual`, early returns for length checks negate the constant-time protection by leaking the secret's length.
**Prevention:** Always hash both strings to a fixed length (e.g., via SHA-256) before using `timingSafeEqual` to guarantee a truly constant-time comparison.

## 2026-06-12 - ReDoS and Memory DoS in Data URL Parsing
**Vulnerability:** Gateway image endpoints parsed massive base64 image data URLs using `.match(/^data:(.+?);base64,([A-Za-z0-9+/=\s]+)$/i)`. This regex is vulnerable to ReDoS due to backtracking on invalid base64 payloads, blocking the event loop.
**Learning:** Using regex on multi-megabyte strings is dangerous. Furthermore, attempting to replace it with `value.toLowerCase().startsWith(...)` introduces a memory DoS by duplicating the entire multi-megabyte string just to check the prefix.
**Prevention:** For large payloads, always use bounded string operations (`value.substring(0, 5).toLowerCase()`) and avoid regex validation of the entire string body. Instead, validate character constraints using an explicit iteration over the string segment.
## 2024-07-04 - Memory DoS in Base64 Image Parsing
**Vulnerability:** The gateway application parsed large base64 image strings using `.toLowerCase()` on the entire payload and stripped whitespace using `.replace(/\s+/g, '')`. This allocated massive new strings in memory, causing severe Garbage Collection pauses and potentially leading to a Memory Denial of Service (DoS) attack.
**Learning:** Using global regex replacement or full-string case conversion on large payloads blocks the main thread and consumes excessive memory.
**Prevention:** Use native string iteration for whitespace stripping without allocating new strings, and perform targeted, localized checks like `.substring(0, 5).toLowerCase()` or use `.indexOf()` with position arguments.
