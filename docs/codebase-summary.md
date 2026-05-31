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
| `src/services/gemini/` | Gemini SDK image/text/chat/video modules |
| `src/services/providers/` | Grok + GPT Image studio services and shared helpers |
| `src/contexts/` | Global providers for language, API config, gallery, Drive, viewer |
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
- `PatternGenerator`

Each feature has an operational product doc under `docs/product/`.

## Studio Modes

`AppContent` also holds a `StudioMode` (`'gemini' | 'grok' | 'gptImage'`,
default `gemini`). A header `StudioModeSwitch` toggles three isolated studios.
Provider studios (Grok, GPT Image) support five workflows
(`PROVIDER_SUPPORTED_FEATURES`) and route through `src/services/providers/*`,
never through the Gemini pipeline. See `docs/product/provider-studios.md` and
the "Studio Modes" section in `docs/ARCHITECTURE.md`.

## Dead Code (Unwired)

The following exist in the tree but are **not** wired into any component or
`App.tsx` (verified by search — no callers):

- `src/hooks/useSwapFace.ts` and `swapFace.*` strings in `src/locales/{en,vi}.ts`.
- `src/hooks/useInpainting.ts` and `inpainting.*` strings in
  `src/locales/{en,vi}.ts`.

They are not part of the live `Feature` enum or any studio. Treat them as dead
code pending cleanup — see Harness backlog item #2
(`scripts/harness query backlog`). Do not document them as live features.

## Architecture Pattern

```text
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

See `docs/ARCHITECTURE.md` for the authoritative app architecture.

## Persistence

- Gallery and cache data: IndexedDB.
- Session state and model preferences: localStorage.
- Optional cloud sync: Google Drive.

## Testing and Validation

Primary commands:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

Boundary coverage includes checks that UI components do not directly import
services.

## Known Documentation Notes

- Harness v0 docs and scripts are present under `docs/` and `scripts/`.
- `harness.db` and `scripts/bin/harness-cli` are local artifacts and remain
  untracked (gitignored).
- The three-provider studio split (Gemini/Grok/GPT Image) is live; see
  `docs/product/provider-studios.md`.
- `useSwapFace` / `useInpainting` are unwired dead code (backlog #2), not live
  features.
- Last resync of these docs to code: 2026-05-31 (story US-002).
