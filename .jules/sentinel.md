## 2024-05-24 - [Fix password input autofill]
**Vulnerability:** Used `autoComplete="off"` for sensitive inputs (API keys) which is widely ignored by modern browsers/password managers.
**Learning:** Browsers have deprecated `autoComplete="off"` for passwords to encourage autofill for legitimate credentials, but for configuration keys we need to actively prevent this leakage to prevent password managers from accidentally saving or overriding API keys.
**Prevention:** Always use `autoComplete="new-password"` for sensitive configuration fields (like API keys, tokens) to reliably prevent password managers from prompting to save or automatically filling them in.
