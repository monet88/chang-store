# Codebase Summary

Chang Store is a React 19 + TypeScript + Vite SPA for AI-powered fashion image
workflows. The app is client-only and uses Google Gemini SDK for AI operations.

## Source Layout

| Path | Role |
| --- | --- |
| `src/components/` | UI layer: feature screens, shared controls, modals |
| `src/hooks/` | Feature state and orchestration logic |
| `src/services/` | Stateless API facades and provider wrappers |
| `src/services/gemini/` | Gemini SDK image/text/chat/video modules |
| `src/contexts/` | Global providers for language, API config, gallery, Drive, viewer |
| `src/utils/` | Prompt builders, image helpers, storage, downloads, workers |
| `src/config/` | Model registry and capability metadata |
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
- `harness.db` is local operational state and should remain untracked.
