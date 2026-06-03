# CLAUDE.md

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA. Gemini is the default full-featured studio; isolated Grok and GPT Image provider studios run five workflows through provider REST services.

## Project map

| Directory | Role |
|-----------|------|
| `src/components/` | UI layer — thin wrappers, feature screens, shared UI, and `modals/` |
| `src/hooks/` | Feature logic + state (one hook per feature) |
| `src/services/` | API facades (stateless), incl. `gemini/` and provider services under `providers/` |
| `src/contexts/` | Global state providers |
| `src/utils/` | Pure helpers, prompt builders (`*-prompt-builder.ts`) |
| `src/config/` | Model capability registries (`modelRegistry.ts`, provider registries) |
| `src/locales/` | i18n: `en.ts` (source of truth) + `vi.ts` |
| `__tests__/` | Mirrors `src/` |
| `docs/` | Architecture, design guidelines, code standards, API refs |

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add a feature | `src/types.ts` → `src/components/` → `src/hooks/` → `src/App.tsx` → `src/locales/en.ts` |
| Gemini service routing | `src/services/imageEditingService.ts` (unified Gemini facade) |
| Provider studio routing | `src/services/providers/*`, `src/config/providerRegistry.ts`, `docs/product/provider-studios.md` |
| Global state | `src/contexts/` (see `src/contexts/AGENTS.md`) |
| i18n strings | `src/locales/en.ts` |
| Model registry | `src/config/modelRegistry.ts`, `grokModelRegistry.ts`, `gptImageModelRegistry.ts` |
| Image processing | `src/utils/imageUtils.ts` |

## Codebase Understanding

If you need broader project context, architecture traversal, or cross-file relationships, refer to the existing Understand Anything knowledge graph artifacts in `.understand-anything/` and use the related Understand Anything skills/dashboard before deep exploration.

## Vite Environment Variables & Deployment (CRITICAL)

**Vite only exposes env vars with `VITE_` prefix to client code.** Non-prefixed vars like `GEMINI_API_KEY` require explicit injection via `vite.config.ts` `define` block.

When deploying to Vercel/Netlify/etc.:
- Set env vars in the hosting platform dashboard (e.g., `GEMINI_API_KEY`, `GROK_API_KEY`, `GPT_IMAGE_API_KEY`)
- Verify `vite.config.ts` injects the key for **all modes** (not just development):
  ```js
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY)
  ```
- Previously: key was only injected when `mode === 'development' && VITE_ENABLE_DIRECT_GEMINI === 'true'`
- Result: production build on Vercel failed with "API_KEY is not configured"

**Rule:** Always test production build (`npm run build`) before deploying. Check that Gemini and configured provider studio API calls work in production, not just dev server.

## Architecture

Gemini workflows: `Component (thin UI) → Hook (state + logic) → Service Facade → Gemini API`

Provider studios: `Provider Studio UI → Provider Hook → src/services/providers/* → Grok/GPT Image REST`.

No React Router — `App.tsx` switches on `Feature` enum with lazy-loading and keeps `StudioMode = 'gemini' | 'grok' | 'gptImage'`. Path alias: `@/*` → `src/`.

Feature enum (`src/types.ts`): `TryOn | Lookbook | Background | Pose | PhotoAlbum | AIEditor | WatermarkRemover | ClothingTransfer | PatternGenerator`

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

Gemini service routing stays centralized in `src/services/imageEditingService.ts` and fans into Gemini service modules under `src/services/gemini/`.

Grok and GPT Image provider studios route through `src/services/providers/*` and never through the Gemini facade. Provider API keys and base URLs must come from `ApiProviderContext`, never hook state. See `docs/product/provider-studios.md` before changing provider contracts.
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

Tailwind only — no inline styles, no `@apply`. Follow the existing Runway-inspired patterns in the app as the canonical UI source of truth.
</important>

<important if="you are refactoring or touching service boundaries">

UI service-import debt has been cleaned up. Components must not import `src/services/*` directly; add or extend a paired hook instead. Provider studio components also go through provider hooks. Boundary coverage lives in `__tests__/components/ui-boundary-imports.test.ts`.
</important>

<important if="you are about to delete files, run destructive git commands, or perform irreversible operations">

- Never delete files without explicit user permission — even files you created.
- Never run `git reset --hard`, `git clean -fd`, `rm -rf` without the user providing the exact command.
- Default branch is `main`. Never use `master`.
</important>

<important if="you are creating or modifying files">

Edit existing files in place. Never create variations like `FeatureV2.tsx` or `Utils_new.ts`. Never use script-based bulk search & replace (e.g. `sed`) on code files.
</important>

<important if="you are reading files with the Read tool">

For normal text, code, markdown, JSON, and command-output files, omit the `pages` parameter entirely. Only pass `pages` when reading a PDF, and never pass `pages: ""` because it causes `Invalid pages parameter` errors and can trap the workflow in a retry loop.
</important>

<important if="you are ending a work session or the user says they are done">

1. File issues/todos for remaining work
2. Run quality gates if code changed: `npx tsc --noEmit`, `npm run lint`, `npm run test`
3. Commit work if applicable
4. Save context summary for the next session
</important>

<important if="you need to smoke-test features that involve image uploads">

Test images are in `docs/image-test/` — use these for any feature that requires uploading photos (subject, clothing, background, etc.):
- `people.jpg` — person/model
- `outfit.jpg` — clothing/outfit
- `shoes.jpg` — footwear

Dev server: `npm run dev` (port 3000). Use `/ck:agent-browser` for automated browser testing.
</important>

<important if="you need to use gstack skills for browsing, QA, review, or deployment">

Use `/gstack-browse` for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
If gstack skills aren't working: `cd .claude/skills/gstack && ./setup --prefix`
</important>

<important if="you are using a third-party library you are not fully confident about">

Search online for latest documentation via Context7 MCP or web search. Do not hallucinate APIs.
</important>

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **chang-store** (4900 symbols, 8237 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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

## GBrain Configuration (configured by /setup-gbrain)
- Engine: postgres
- Config file: ~/.gbrain/config.json (mode 0600)
- Setup date: 2026-04-26
- MCP registered: yes
- Memory sync: artifacts-only
- Current repo policy: read-write

---

# Session Memory System

This project uses an automated session memory system that logs work at context thresholds and restores it after compaction.

## Session Model

Each session log represents one Claude's context window. Multiple Claudes work one after the other, each with its own log.

| Scenario | Trigger | `continues:` field | Previous context loaded? |
|----------|---------|-------------------|--------------------------|
| **Continuation** | `/compact` or autocompaction | Yes — links to previous session | Yes — hook injects previous log |
| **Fresh session** | `/clear`, new CC session | No | No — orient from index |

**Continuation** carries the workstream across a context reset with a handoff summary. **Fresh session** starts independently — no prior context injected.

## At Session Start

If `.claude/memory/index.md` exists, read it for orientation.

## Logging

The cc-context-awareness system injects reminders at 50%, 65%, and 80% context usage. At 50%, read the logging guide at `.claude/skills/log-session-memory/SKILL.md` and follow it to create your session log. Later reminders tell you to update the log in place — edit existing sections to reflect current state, update `context_at_log` in frontmatter.

## After Compaction

A hook loads the most recent session log. Always create a **new** session directory and log. Add `continues: <previous-session>` to the YAML frontmatter. Update `index.md`.

## Archival

When 5+ session directories accumulate, a hook injects archival instructions. Delegate to the `memory-archiver` agent (`.claude/agents/memory-archiver.md`), then handle the cleanup it requests.

## Content Placement

| Store | Location | Content | Character |
|-------|----------|---------|-----------|
| **Session logs** | `.claude/memory/session-*/` | Per-session work, decisions, handoff data | Ephemeral. One Claude's context window. |
| **Session index** | `.claude/memory/index.md` | Execution history, durable observations | Historical. Accumulates. |
| **Auto-memory** | `MEMORY.md` (CC native) | Current repo state, working notes | Living. Changes with code. No history. |

- **`MEMORY.md`** reflects the present — when code changes, it changes. Stale entries removed.
- **`index.md`** accumulates the past — session history, durable observations. Entries persist.

If you write to `MEMORY.md`, include a pointer: `## Session Memory` — `Session-specific work logs at .claude/memory/ — see index.md for history.`
