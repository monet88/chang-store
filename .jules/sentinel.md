## 2026-06-11 - Timing Attack Vulnerability in Gateway Auth
**Vulnerability:** The `constantTimeEqual` function in `gateway/src/auth/gateway-auth.ts` used an early return if string lengths mismatched, exposing the API key length to timing attacks.
**Learning:** Even when using `timingSafeEqual`, early returns for length checks negate the constant-time protection by leaking the secret's length.
**Prevention:** Always hash both strings to a fixed length (e.g., via SHA-256) before using `timingSafeEqual` to guarantee a truly constant-time comparison.
