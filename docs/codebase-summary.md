# Codebase Summary

Chang Store is a React 19 + TypeScript + Vite SPA for AI-powered fashion image
workflows. Core workflows use the Google Gemini SDK, while isolated Grok and
GPT Image studios call provider REST endpoints directly from the browser.

## Source Layout

| Path | Role |
| --- | --- |
| `src/components/` | UI layer: feature screens, shared controls, modals |
| `src/hooks/` | Feature state and orchestration logic |
| `src/services/` | Stateless API facades and provider wrappers |
| `src/services/gemini/` | Gemini SDK image/text/chat modules |
| `src/services/providers/` | Grok + GPT Image studio services and shared helpers |
| `src/contexts/` | Global providers for language, API config, gallery, viewer |
| `src/utils/` | Prompt builders, image helpers, storage, downloads, workers |
| `src/config/` | Model registry and capability metadata (Gemini + provider registries) |
| `src/locales/` | i18n strings (`en.ts` source, `vi.ts` mirror) |
| `__tests__/` | Unit and boundary tests mirroring source behavior |

## Feature Enum

Current feature set in `src/types.ts`:

- `TryOn`
- `Lookbook`
- `Background`
- `Pose`
- `PhotoAlbum`
- `AIEditor`
- `WatermarkRemover`
- `ClothingTransfer`
- `IdentityTransfer`
- `PatternGenerator`

Each feature has an operational product doc under `docs/product/`.

## Studio Modes

`AppContent` also holds a `StudioMode` (`'gemini' | 'grok' | 'gptImage'`,
default `gemini`). A header `StudioModeSwitch` toggles three isolated studios.
Provider studios (Grok, GPT Image) support five workflows
(`PROVIDER_SUPPORTED_FEATURES`) and route through `src/services/providers/*`,
never through the Gemini pipeline. See `docs/product/provider-studios.md` and
the "Studio Modes" section in `docs/ARCHITECTURE.md`.

## Dead Code Cleanup

Unwired `useSwapFace` / `useInpainting` hooks and their locale keys were removed
as Harness backlog item #2. They are not part of the live `Feature` enum or any
studio.

## Architecture Pattern

```text
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

See `docs/ARCHITECTURE.md` for the authoritative app architecture.

## Persistence

- Gallery and cache data: IndexedDB.
- Session state and model preferences: localStorage.

## Testing and Validation

Primary commands:

```bash
npx tsc --noEmit            # Type check
npm run lint                # ESLint
npm run test                # Vitest (unit + boundary)
npm run test -- --coverage  # Vitest with V8 coverage report
npm run build               # Production build
```

Boundary coverage includes checks that UI components do not directly import
services.

### Historical Test Suite Metrics

Measured on the 2026-07-03 resync (`npm run test` + `--coverage`, V8 provider).
These numbers are retained as dated evidence and were not re-claimed as current
by the 2026-07-16 documentation backfill:

| Metric | Value |
| --- | --- |
| Test files | 70 |
| Tests | 725 (all passing) |
| Line coverage | 74.85% (2858 / 3818) |
| Statement coverage | 73.96% (3063 / 4141) |
| Function coverage | 71.94% (682 / 948) |
| Branch coverage | 64.74% (1045 / 1614) |

Well-covered areas (>90% lines): prompt builders (`utils/*-prompt-builder.ts`),
provider services (`services/providers/grok`, `services/providers/gpt-image`),
Gemini `text.ts`, and most Virtual Try-On / Lookbook / Photo Album hooks.

Lower-covered areas (opportunities, not regressions): `utils/imageUtils.ts`
(~23%), the Watermark Remover hook
family (engine/queue/actions, 0% — logic exercised by the historical live E2E
run below), and
`services/gemini/chat.ts` (0%, refine-session path).

### Historical Live E2E Verification

A previous live end-to-end harness drove the real app service layer against the
Vertex gateway
(`https://vertex.monet.uno/gemini`) using the sample images in
`docs/image-test/`. It exercised all nine features plus text generation, vision
description, image generation, and upscale — 13 flows total. The
`scripts/e2e-live/` runner and its fixtures are retired or absent in the
current checkout, so this is historical evidence rather than a current command.

Last recorded run (2026-07-03): 11/13 flows returned valid output. The two
non-passing
flows were external-runtime conditions, not app defects:

- Watermark Remover — the model declined the specific sample image (returned a
  refusal text instead of an image). The same code path succeeds on other
  images.
- Clothing Transfer — a transient `UPSTREAM_QUOTA` response; it passed on the
  first run and on isolated retry.

This live run also surfaced and fixed a real bug: the Gemini vision helpers in
`src/services/gemini/text.ts` sent `contents: { parts }` (no role), which the
gateway rejected with `VALIDATION_FAILED`. They now send
`contents: [{ role: 'user', parts }]`, verified live.

Gemini routing always goes through the CPA gateway
(`https://cliproxy.monet.uno`), configured in Settings → "CPA Gateway" (URL plus
optional API key; the key is stored in localStorage as plaintext — use a trusted
device only). The default key comes from `CLIPROXY_API_KEY` at build time. There
is no direct-Google mode.

## Known Documentation Notes

- The three-provider studio split (Gemini/Grok/GPT Image) is live; see
  `docs/product/provider-studios.md`.
- `useSwapFace` / `useInpainting` were removed as unwired dead code (backlog #2).
- Last documentation resync: 2026-07-16. The 2026-07-03 test/E2E metrics above
  remain historical; current source changes require a fresh runtime run before
  those claims are promoted.
