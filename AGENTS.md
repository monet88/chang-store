# Agent Instructions

Always reponse in Vietnamese

## Chang Store — AI-Powered Virtual Fashion Studio

React 19 + TypeScript + Vite SPA. Gemini is the default full-featured studio; isolated Grok and GPT Image provider studios run five workflows through provider REST services.

### Quick Reference

| Task | Start Here |
| --- | --- |
| Understand the product | `docs/product/overview.md` |
| Understand architecture | `docs/ARCHITECTURE.md` |
| Code conventions | `docs/code-standards.md` |
| Add a feature | `src/types.ts` → component → hook → App.tsx → locales |
| Gemini service routing | `src/services/imageEditingService.ts` |
| Provider studio routing | `src/services/providers/*`, `docs/product/provider-studios.md` |
| Model registry | `src/config/modelRegistry.ts`, `grokModelRegistry.ts`, `gptImageModelRegistry.ts` |
| i18n strings | `src/locales/en.ts` (source) + `vi.ts` (mirror) |
| Feature behavior | `docs/product/<feature>.md` |
| Image processing | `src/utils/imageUtils.ts` |
| Global state | `src/contexts/` |

### Codebase Understanding

If you need broader project context or cross-file relationships, refer to the existing Understand Anything knowledge graph artifacts in `.understand-anything/` and use the related Understand Anything skills/dashboard before deep exploration.

### Project Map

| Directory | Role |
|-----------|------|
| `src/components/` | UI layer — thin wrappers, feature screens, shared UI, `modals/` |
| `src/hooks/` | Feature logic + state (one hook per feature) |
| `src/services/` | API facades (stateless), incl. `gemini/` and provider services under `providers/` |
| `src/contexts/` | Global state providers |
| `src/utils/` | Pure helpers, prompt builders (`*-prompt-builder.ts`) |
| `src/config/` | Model capability registries (`modelRegistry.ts`, provider registries) |
| `src/locales/` | i18n: `en.ts` (source of truth) + `vi.ts` |
| `__tests__/` | Mirrors `src/` |
| `docs/` | Architecture, design guidelines, code standards, API refs |

### Architecture Pattern

```
Gemini: Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API
Provider studios: Provider UI → Provider Hook → src/services/providers/* → Grok/GPT Image REST
```

- Components: zero business logic, render only.
- Hooks: own all state, API calls, error handling.
- Services: stateless facades, never import hooks or components.
- Components must not import services directly — use paired hooks.
- No React Router — `App.tsx` switches on `Feature` enum with lazy-loading and keeps `StudioMode = 'gemini' | 'grok' | 'gptImage'`.

### Feature Enum

Features route via `Feature` enum in `src/types.ts`:
`TryOn | Lookbook | Background | Pose | PhotoAlbum | AIEditor | WatermarkRemover | ClothingTransfer | PatternGenerator`

Provider studios support only `TryOn | Lookbook | ClothingTransfer | PatternGenerator | AIEditor` (`PROVIDER_SUPPORTED_FEATURES`).

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
- Exception: self-contained gateway-served admin HTML/CSS with no frontend build step may use local `<style>` blocks and minimal inline layout styles when keeping that surface isolated from the SPA is intentional.
- Never bypass `imageEditingService.ts` for Gemini API calls.
- Provider studios must use `src/services/providers/*`, never the Gemini facade.
- API keys and provider base URLs from `ApiProviderContext`, never hook state.
- Path alias: `@/*` → `src/`.
- i18n: never hardcode user-facing strings.
- Edit files in place. Never create `FeatureV2.tsx` or `Utils_new.ts`.
- Default branch is `main`. Never use `master`.
- Mandatory error handling: `try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }`

### Vite Environment Variables (Critical)

Vite only exposes env vars with `VITE_` prefix. Non-prefixed vars like `GEMINI_API_KEY`, `GROK_API_KEY`, and `GPT_IMAGE_API_KEY` require explicit injection via `vite.config.ts` `define` block. Always test `npm run build` before deploying — verify Gemini and configured provider studio API calls work in production, not just dev.

### Service Boundaries

UI service-import debt has been cleaned up. Components must not import `src/services/*` directly; use paired hooks. Provider studio components also go through provider hooks. Boundary coverage: `__tests__/components/ui-boundary-imports.test.ts`.

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
- `& '.\\scripts\\bin\\harness-cli.exe' query matrix` (Windows)

Use the Rust Harness CLI as the main operational tool. On Windows, always use
the native executable directly: `& '.\scripts\bin\harness-cli.exe' <command>`.
This repo-local `harness-cli.exe` is the Windows `harness.exe` entrypoint; do
not use `scripts/harness` or Git Bash for Harness operations on Windows. On
Git Bash/Linux, use the stable repo-local launcher `scripts/harness`, which
uses the prebuilt Rust binary at `scripts/bin/harness-cli`.

### Mandatory Harness Operating Loop

Every meaningful agent task in this repo must leave durable Harness evidence.
Do this before coding, while working, and before final handoff. Tiny typo/docs
tasks may skip story creation, but must still run intake and trace when the work
is user-requested and repo-scoped.

1. Start with intake before planning or implementation:

```powershell
& '.\\scripts\\bin\\harness-cli.exe' intake `
  --type "Maintenance request" `
  --summary "Short task summary" `
  --lane normal `
  --flags "Existing behavior,Weak proof" `
  --docs "docs/HARNESS.md,docs/FEATURE_INTAKE.md" `
  --notes "Context notes"
```

Use lanes consistently:

- `tiny`: small docs/copy/config touch with low risk.
- `normal`: ordinary bugfix, feature, or process work.
- `high-risk`: auth, data loss, migration, external provider, security, or public contract work.

2. For trackable work that is not tiny, create or update a durable story:

```powershell
& '.\\scripts\\bin\\harness-cli.exe' story add `
  --id "OPS-SHORT-ID" `
  --title "Human readable title" `
  --lane normal `
  --contract "What should be true after this work" `
  --notes "Extra context"
```

After proof exists, update story status and proof flags. Current CLI proof flags
use `0`/`1`, not `yes`/`no`:

```powershell
& '.\\scripts\\bin\\harness-cli.exe' story update `
  --id "OPS-SHORT-ID" `
  --status implemented `
  --unit 0 `
  --integration 0 `
  --e2e 0 `
  --platform 1 `
  --evidence "What proof exists"
```

3. When repeated friction or process pain appears, add backlog instead of losing
the learning:

```powershell
& '.\\scripts\\bin\\harness-cli.exe' backlog add `
  --title "Reusable recovery checklist" `
  --while "Where the pain appeared" `
  --pain "What was hard, repeated, or ambiguous" `
  --suggestion "What should be added or improved" `
  --risk normal `
  --predicted "Expected benefit"
```

4. When a long-lived decision is made, write a decision record under
`docs/decisions/` and add a durable decision row when the CLI decision workflow
is available. Per upstream decision `0006`, `trace --decisions` does not replace
the decision log for high-risk or durable decisions.

5. End every meaningful task with trace. This is the most important step for
future agents:

```powershell
& '.\\scripts\\bin\\harness-cli.exe' trace `
  --summary "What was completed" `
  --intake 2 `
  --story "OPS-SHORT-ID" `
  --agent codex `
  --outcome completed `
  --actions "read docs,updated files,ran validation" `
  --read "docs/HARNESS.md,harness-cli.exe query matrix" `
  --changed "AGENTS.md" `
  --decisions "none" `
  --errors "none" `
  --friction "none"
```

6. Query Harness frequently to avoid guessing:

```powershell
& '.\\scripts\\bin\\harness-cli.exe' query stats
& '.\\scripts\\bin\\harness-cli.exe' query matrix
& '.\\scripts\\bin\\harness-cli.exe' query backlog
& '.\\scripts\\bin\\harness-cli.exe' query decisions
& '.\\scripts\\bin\\harness-cli.exe' query traces
& '.\\scripts\\bin\\harness-cli.exe' query friction
```

Use `matrix` for proof status, `backlog` for unresolved process/tooling pain,
`decisions` for durable choices, `traces` for prior work, and `friction` for
repeated issues that need improvement.

7. When updating Harness from upstream, follow the current installer/update
instructions in `docs/HARNESS.md` and then run:

```powershell
& '.\\scripts\\bin\\harness-cli.exe' migrate
& '.\\scripts\\bin\\harness-cli.exe' query stats
git diff --check
```

If `--merge` preserves an older `scripts/bin/harness-cli`, update the binary
from the matching release asset or choose an installer mode that intentionally
overwrites with backups.
<!-- HARNESS:END -->

# CodeGraph — Code Intelligence

This repo works better with CodeGraph, especially under
`gateway/`. Use CodeGraph MCP tools as the default semantic navigation layer.

## Always Do

- **Check CodeGraph index health first** with `codegraph_status` when starting a
  non-trivial code-reading or refactor task.
- **Before editing a function, class, or method, inspect blast radius** with
  `codegraph_impact(symbol)` when it resolves cleanly. If impact is ambiguous,
  at minimum inspect `codegraph_callers(symbol)` and `codegraph_callees(symbol)`
  and report the direct surface you found.
- When exploring unfamiliar code, start with `codegraph_search` or
  `codegraph_context` instead of broad grep.
- When you need exact symbol detail, use `codegraph_node`.
- When you need inbound or outbound usage, use `codegraph_callers` and
  `codegraph_callees`.
- When you need an end-to-end flow, use `codegraph_trace(from, to)`.

## Never Do

- NEVER rename symbols with blind find-and-replace when CodeGraph can first show
  callers, callees, and impact.
- NEVER skip blast-radius review for shared gateway or service-layer code. If
  `codegraph_impact` does not resolve, fall back to callers/callees plus
  targeted file reads before editing.

## Recommended Workflow

1. `codegraph_status` — verify the index is available.
2. `codegraph_search` — find the symbol or file quickly.
3. `codegraph_node` — inspect signature and location.
4. `codegraph_impact` — check likely blast radius when available.
5. `codegraph_callers` / `codegraph_callees` — confirm direct usage.
6. `codegraph_trace` — answer concrete flow questions.

## Notes

- `codegraph_context` is useful for broad architecture questions, but for this
  repo it can be noisier than `search + node + callers/callees` on narrow
  gateway tasks.
- If CodeGraph misses a known symbol, fall back to targeted `rg` and direct file
  reads directly.
