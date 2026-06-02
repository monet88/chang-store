# 2026-06-02 — Vertex CLI Proxy Toggle completion

- Shipped Gemini-side Vertex Proxy toggle through Settings UI + `ApiProviderContext` + `apiClient`.
- Added atomic proxy config wiring: `apiVersion: 'v1beta'`, `httpOptions.baseUrl`, explicit proxy key requirement, direct-client bypass for video/Veo.
- Reworked Gemini text-to-image proxy path to use `generateContent()` + `inlineData` parsing instead of direct `generateImages()`.
- Added proxy timeout (30s), quota fallback to `imagen-4.0-fast-generate-001`, and surfaced fallback metadata/warning path through `imageEditingService`.
- Migrated text defaults/helpers off stale Gemini 2 / preview IDs to exact `gemini-3.5-flash` and `gemini-3.1-pro`.
- Backfilled tests across client wiring, settings state/UI, image service proxy path, image facade warning path, text services, model selection, and lookbook expectation drift.
- Final gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (702/702), `npm run build`.

Unresolved questions:
- None.
