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
| Image processing | `src/utils/imageUtils.ts` |
| Global state | `src/contexts/` |

### Project Map

| Directory | Role |
|-----------|------|
| `src/components/` | UI layer — thin wrappers, feature screens, shared UI, `modals/` |
| `src/hooks/` | Feature logic + state (one hook per feature) |
| `src/services/` | API facades (stateless), incl. `gemini/` |
| `src/contexts/` | Global state providers |
| `src/utils/` | Pure helpers, prompt builders (`*-prompt-builder.ts`) |
| `src/config/` | Model capability registry (`modelRegistry.ts`) |
| `src/locales/` | i18n: `en.ts` (source of truth) + `vi.ts` |
| `__tests__/` | Mirrors `src/` |
| `docs/` | Architecture, design guidelines, code standards, API refs |

### Architecture Pattern

```
Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
```

- Components: zero business logic, render only.
- Hooks: own all state, API calls, error handling.
- Services: stateless facades, never import hooks or components.
- Components must not import services directly — use paired hooks.
- No React Router — `App.tsx` switches on `Feature` enum with lazy-loading.

### Feature Enum

Features route via `Feature` enum in `src/types.ts`:
`TryOn | Lookbook | Background | Pose | PhotoAlbum | AIEditor | WatermarkRemover | ClothingTransfer | PatternGenerator | WardrobeMode`

### Adding a Feature (5-step checklist)

1. `src/types.ts` → add `Feature.XxxYyy`
2. `src/components/XxxYyy.tsx` — thin UI (see any existing feature component)
3. `src/hooks/useXxxYyy.ts` — all logic (see any existing feature hook)
4. `src/App.tsx` — lazy import + switch case
5. `src/locales/en.ts` → add keys; `vi.ts` → add translations

### Provider Order (do not reorder)

`LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent`

`ToastProvider` lives in `src/components/Toast.tsx`, NOT in `contexts/`.

### Quality Gates

```bash
npx tsc --noEmit    # Type check
npm run lint        # ESLint
npm run test        # Vitest
npm run dev         # Dev server (port 3000)
npm run build       # Production build
```

After any substantive code changes, run `npx tsc --noEmit` and `npm run lint`. Do not suppress type errors with `@ts-ignore` or `any` unless absolutely necessary.

### Key Constraints

- Tailwind only — no inline styles, no CSS modules, no `@apply`.
- Never bypass `imageEditingService.ts` for API calls.
- API keys from `ApiProviderContext`, never hook state.
- Path alias: `@/*` → `src/`.
- i18n: never hardcode user-facing strings.
- Edit files in place. Never create `FeatureV2.tsx` or `Utils_new.ts`.
- Default branch is `main`. Never use `master`.
- Mandatory error handling: `try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }`

### Vite Environment Variables (Critical)

Vite only exposes env vars with `VITE_` prefix. Non-prefixed vars like `GEMINI_API_KEY` require explicit injection via `vite.config.ts` `define` block. Always test `npm run build` before deploying — verify Gemini API calls work in production, not just dev.

### Service Boundaries

UI service-import debt has been cleaned up. Components must not import `src/services/*` directly; use paired hooks. Boundary coverage: `__tests__/components/ui-boundary-imports.test.ts`.

### Test Images

Test images in `docs/image-test/`:
- `people.jpg` — person/model
- `outfit.jpg` — clothing/outfit
- `shoes.jpg` — footwear

### Third-Party Libraries

Search online for latest documentation via Context7 MCP or web search. Do not hallucinate APIs.

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **chang-store** (3438 symbols, 5369 relationships, 209 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/chang-store/context` | Codebase overview, check index freshness |
| `gitnexus://repo/chang-store/clusters` | All functional areas |
| `gitnexus://repo/chang-store/processes` | All execution flows |
| `gitnexus://repo/chang-store/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
