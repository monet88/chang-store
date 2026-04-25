<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# Chang-Store

## Purpose
AI-powered virtual fashion studio built as a React 19 + TypeScript + Vite SPA with a Gemini-only AI backend via the Google Gemini SDK. The app supports fashion image creation, editing, analysis, upscaling, gallery review, and Google Drive-backed archive workflows.

## Key Files
| File | Description |
|------|-------------|
| `CLAUDE.md` | Project-specific operating instructions for AI agents, including architecture, feature checklist, verification, and GitNexus rules. |
| `package.json` | npm scripts, dependencies, and dev tooling for React/Vite/Vitest/ESLint. |
| `vite.config.ts` | Vite configuration and `@/*` path alias setup. |
| `vitest.config.ts` | Vitest/jsdom coverage configuration. |
| `eslint.config.js` | ESLint 9 configuration for TypeScript/React code. |
| `index.html` | Vite HTML entry template. |
| `setupTests.ts` | Global test setup importing `@testing-library/jest-dom`. |
| `README.md` | Human-facing project overview and setup notes. |
| `release-manifest.json` | Large generated/release metadata artifact; inspect carefully before editing. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | Main application source code: app shell, components, hooks, services, contexts, config, locales, and utilities (see `src/AGENTS.md`). |
| `__tests__/` | Vitest + React Testing Library suites mirroring source structure (see `__tests__/AGENTS.md`). |
| `docs/` | Architecture docs, vendor/API references, and planning artifacts (see `docs/AGENTS.md`). |
| `plans/` | Planning reports, templates, and session artifacts; currently git-ignored locally (see `plans/AGENTS.md`). |
| `types/` | Ambient TypeScript declarations for browser/vendor globals (see `types/AGENTS.md`). |

## Project Map

| Directory | Role |
|-----------|------|
| `src/components/` | UI layer — thin wrappers, feature screens, `upscale/`, `modals/`, and shared UI. |
| `src/hooks/` | Feature logic + state; one hook per feature where possible. |
| `src/services/` | API facades (stateless), including provider-specific Gemini modules. |
| `src/contexts/` | Global state providers. |
| `src/utils/` | Pure helpers, prompt builders, image utilities, cache, storage, and ZIP/download helpers. |
| `src/config/` | Model capability registry and model selection rules. |
| `src/locales/` | i18n dictionaries: `en.ts` is source of truth and `vi.ts` mirrors it. |
| `__tests__/` | Mirrors `src/` for components, hooks, services, contexts, config, and utils. |
| `docs/` | Architecture and API/vendor references. |

## Where To Look

| Task | Location |
|------|----------|
| Add a feature | `src/types.ts` → `src/components/` → `src/hooks/` → `src/App.tsx` → `src/locales/en.ts` → `src/locales/vi.ts` |
| Service routing | `src/services/imageEditingService.ts` (unified facade) |
| Provider-specific Gemini logic | `src/services/gemini/` |
| Global state | `src/contexts/` (see `src/contexts/AGENTS.md`) |
| i18n strings | `src/locales/en.ts` first, then `src/locales/vi.ts` |
| Model registry | `src/config/modelRegistry.ts` and `src/config/modelSelectionRules.ts` |
| Image processing | `src/utils/imageUtils.ts` |
| Prompt builders | `src/utils/*-prompt-builder.ts` and selected co-located prompt files |
| Tests | `__tests__/` matching the source layer being changed |

## Architecture

`Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API`

No React Router — `src/App.tsx` switches on `Feature` enum with lazy-loading. Path alias: `@/*` maps to `src/`.

Feature enum (`src/types.ts`): `TryOn | Lookbook | Background | Pose | PhotoAlbum | OutfitAnalysis | Relight | Upscale | ImageEditor | AIEditor | WatermarkRemover | ClothingTransfer | PatternGenerator`.

Provider nesting order matters:
`LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent`

`ToastProvider` lives in `src/components/Toast.tsx`, not in `src/contexts/`.

## For AI Agents

### Working In This Repository
- Start with this file and `CLAUDE.md`, then read the nearest nested `AGENTS.md` before modifying a directory.
- Keep components as thin UI wrappers; all state, validation, API calls, and gallery integration belong in paired hooks.
- Never call services directly from new components; route through hooks and existing facades.
- Do not bypass `src/services/imageEditingService.ts` for feature image API calls.
- Do not store API keys in hooks or component state; use `ApiProviderContext`.
- Do not create duplicate “V2/new” files; edit existing files in place.
- Do not delete files or run destructive git commands without explicit user permission.
- Before editing a function/class/method, follow the project GitNexus impact-analysis requirement below.

### Testing Requirements
- After substantive code changes, run `npx tsc --noEmit` and `npm run lint`.
- Use `npm run test` for Vitest run-once, or target a specific test file with `npm run test -- path/to/file.test.tsx`.
- Documentation-only changes do not require TypeScript/lint/test runs, but parent-link and hierarchy validation should pass.
- Do not suppress type errors with `@ts-ignore` or `any` unless absolutely necessary.

### Common Patterns
- Hooks use `useLanguage()` + `useApi()` + optional `useImageGallery()`.
- Mandatory async hook error pattern: `try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }`.
- Feature model routing goes through `resolveModelSelectionScope()` / `getModelsBySelectionType()` and the registry in `src/config/`.
- Batch hooks use bounded concurrency helpers such as `run-bounded-workers.ts`.
- Tailwind only — no inline styles and no `@apply`.
- i18n usage: `const { t } = useLanguage(); t('key.path')`.

### Known Tech Debt
These components import services directly and should be handled carefully during refactors:
`AIEditor`, `ImageEditor`, `LookbookOutput`, `SettingsModal`, `Relight`, `PoseChanger`, `PhotoAlbumCreator`, `OutfitAnalysis`, `shared/RefinementInput`.

## Important Workflows

<important if="you need to run commands to build, test, lint, or type-check">

| Command | What it does |
|---------|-------------|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Production build |
| `npm run test` | Vitest run-once |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |

After any substantive code changes, run `npx tsc --noEmit` and `npm run lint` to verify no errors. Do not suppress type errors with `@ts-ignore` or `any` unless absolutely necessary.
</important>

<important if="you are adding a new feature to the application">

5-step checklist:
1. `src/types.ts` → add `Feature.XxxYyy`
2. `src/components/XxxYyy.tsx` — thin UI (see any existing feature component for pattern)
3. `src/hooks/useXxxYyy.ts` — all logic (see any existing feature hook for pattern)
4. `src/App.tsx` — lazy import + switch case
5. `src/locales/en.ts` → add keys; `vi.ts` → add translations
</important>

<important if="you are modifying service routing, API calls, or provider integration">

Service routing stays centralized in `src/services/imageEditingService.ts` and fans into Gemini service modules under `src/services/gemini/`.

Never bypass `imageEditingService.ts` for API calls. API keys must come from `ApiProviderContext`, never hook state.
</important>

<important if="you are modifying providers, context, or global state">

Provider nesting order matters (each depends on parent):
`LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent`

`ToastProvider` lives in `src/components/Toast.tsx`, NOT in `contexts/`.
</important>

<important if="you are writing or modifying components or hooks">

Components must be thin UI wrappers with zero business logic. All state, API calls, and gallery integration go in the paired hook. See any existing component/hook pair for the pattern.

Never put business logic in components. Never call services directly from components — go through hooks. Every feature component must have a paired hook.

Mandatory error handling: `try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }`
</important>

<important if="you are adding or modifying i18n strings or translations">

Source of truth: `src/locales/en.ts`. `vi.ts` mirrors it.
Usage: `const { t } = useLanguage(); t('key.path')`
</important>

<important if="you are writing styles or modifying UI appearance">

Tailwind only — no inline styles, no `@apply`. Follow the existing Runway-inspired design patterns in the app and the canonical design docs when available.
</important>

<important if="you are refactoring or touching components that import services directly">

Known tech debt — these components import services directly (should go through hooks):
`AIEditor`, `ImageEditor`, `LookbookOutput`, `SettingsModal`, `Relight`, `PoseChanger`, `PhotoAlbumCreator`, `OutfitAnalysis`, `shared/RefinementInput`
</important>

<important if="you are about to delete files, run destructive git commands, or perform irreversible operations">

- Never delete files without explicit user permission — even files you created.
- Never run `git reset --hard`, `git clean -fd`, `rm -rf` without the user providing the exact command.
- Default branch is `main`. Never use `master`.
</important>

<important if="you are creating or modifying files">

Edit existing files in place. Never create variations like `FeatureV2.tsx` or `Utils_new.ts`. Never use script-based bulk search & replace (e.g. `sed`) on code files.
</important>

<important if="you are ending a work session or the user says they are done">

1. File issues/todos for remaining work
2. Run quality gates if code changed: `npx tsc --noEmit`, `npm run lint`, `npm run test`
3. Commit work if applicable
4. Save context summary for the next session
</important>

<important if="you need to use gstack skills for browsing, QA, review, or deployment">

Use `/gstack-browse` for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
If gstack skills aren't working: `cd .agents/skills/gstack && ./setup --prefix`
</important>

<important if="you are using a third-party library you are not fully confident about">

Search online for latest documentation via Context7 MCP or web search. Do not hallucinate APIs.
</important>

## Dependencies

### Internal
- `src/components/`, `src/hooks/`, `src/services/`, `src/contexts/`, `src/utils/`, `src/config/`, and `src/locales/` form the main layered application.
- `__tests__/` mirrors those layers for verification.
- `docs/ARCHITECTURE.md` provides a graph-derived system overview.

### External
- React 19, React DOM, Vite, TypeScript, Vitest, ESLint, Tailwind CSS.
- `@google/genai` for Gemini AI integration.
- `jszip` for ZIP export workflows.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Chang-Store** (1209 symbols, 2298 relationships, 88 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/Chang-Store/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Chang-Store/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Chang-Store/clusters` | All functional areas |
| `gitnexus://repo/Chang-Store/processes` | All execution flows |
| `gitnexus://repo/Chang-Store/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

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

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
