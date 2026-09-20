## 2024-05-24 - [Ensure autoComplete="new-password" for sensitive fields]
**Vulnerability:** Gateway API keys were using `autoComplete="off"` in password fields. Modern browsers and password managers often ignore `autoComplete="off"` and may still attempt to auto-fill or prompt to save these keys as site passwords.
**Learning:** For sensitive configuration inputs like API keys, always use `autoComplete="new-password"` instead of `autoComplete="off"` to reliably prevent modern browsers and password managers from unexpectedly saving or autofilling credentials.
**Prevention:** Standardize on `autoComplete="new-password"` for all password-type input fields handling sensitive keys or tokens across the application.
