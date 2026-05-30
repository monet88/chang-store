# Agent Instructions

## Chang Store — AI-Powered Virtual Fashion Studio

React 19 + TypeScript + Vite SPA. Gemini-only AI backend via Google Gemini SDK.

### Quick Reference

| Task | Start Here |
| --- | --- |
| Understand the product | `docs/product/overview.md` |
| Understand architecture | `docs/ARCHITECTURE.md` |
| Code conventions | `docs/code-standards.md` |
| Add a feature | `src/types.ts` → component → hook → App.tsx → locales |
| Service routing | `src/services/imageEditingService.ts` |
| Model registry | `src/config/modelRegistry.ts` |
| i18n strings | `src/locales/en.ts` (source) + `vi.ts` (mirror) |
| Feature behavior | `docs/product/<feature>.md` |

### Architecture Pattern

```
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

- Components: zero business logic, render only.
- Hooks: own all state, API calls, error handling.
- Services: stateless facades, never import hooks or components.
- Components must not import services directly.

### Feature Enum

Features route via `Feature` enum in `src/types.ts`:
`TryOn | Lookbook | Background | Pose | PhotoAlbum | AIEditor | WatermarkRemover | ClothingTransfer | PatternGenerator`

### Provider Order (do not reorder)

`LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent`

### Quality Gates

```bash
npx tsc --noEmit    # Type check
npm run lint        # ESLint
npm run test        # Vitest
```

### Key Constraints

- Tailwind only — no inline styles, no CSS modules.
- Never bypass `imageEditingService.ts` for API calls.
- API keys from `ApiProviderContext`, never hook state.
- Path alias: `@/*` → `src/`.
- i18n: never hardcode user-facing strings.

<!-- HARNESS:BEGIN -->
## Harness

This repo uses Harness. Before work, read:

- `README.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`
- `scripts/harness query matrix`

Use the Rust Harness CLI as the main operational tool. Run it through the
stable repo-local entrypoint `scripts/harness`, which uses the prebuilt Rust
binary at `scripts/bin/harness-cli` in installed projects.
<!-- HARNESS:END -->
