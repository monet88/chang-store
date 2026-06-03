# 2026-06-02 — Vertex CLI Proxy Toggle completion

- Shipped Gemini-side Vertex Proxy toggle through Settings UI + `ApiProviderContext` + `apiClient`.
- Added atomic proxy config wiring: `apiVersion: 'v1beta'`, `httpOptions.baseUrl`, and explicit proxy key requirement.
- Reworked Gemini text-to-image proxy path to use `generateContent()` + `inlineData` parsing.
- Added proxy timeout (30s) for Gemini image generation.
- Migrated text defaults/helpers to exact `gemini-3.5-flash` and `gemini-3.1-pro-preview`.
- Backfilled tests across client wiring, settings state/UI, image service proxy path, text services, model selection, and lookbook expectation drift.
- Final gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (702/702), `npm run build`.

Unresolved questions:
- None.
