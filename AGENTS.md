# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-02
**Commit:** 5ff2755
**Branch:** main

## OVERVIEW
Chang-Store: AI-powered virtual fashion studio. React 19 + TypeScript 5.8 + Vite 6 SPA.
Core flow: Component (UI) → Hook (logic) → Service (facade) → Provider (Gemini | Local | Anti).

## PROVIDERS (SETTINGS)
- Google (Gemini SDK, `@google/genai`)
- Proxypal Provider (local REST, `local--*` prefix)
- Anti Provider (REST, `anti--*` prefix)

## STRUCTURE
```
./
├── App.tsx              # Provider stack + lazy feature router
├── index.tsx            # Entry point
├── types.ts             # Feature enum, ImageFile, AspectRatio
├── components/          # 51 files: 14 features + shared + modals
├── hooks/               # 13 hooks: 1 per feature, all business logic
├── contexts/            # 5 providers: API keys, language, gallery, viewer, Drive
├── services/            # 12 files: facade routing + provider implementations
│   └── gemini/          # Gemini-specific: image, text, video
├── utils/               # 10 files: prompt builders, image processing, model configs
├── config/              # modelRegistry.ts
├── locales/             # en.ts (source), vi.ts
├── __tests__/           # 19 test files + mocks (mirrors source structure)
├── docs/                # Architecture, code standards, API docs
└── plans/               # Session plans + reports
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add feature UI | `components/FeatureName.tsx` + lazy import in `App.tsx` | Pair with hook |
| Feature logic | `hooks/useFeatureName.ts` | All state, validation, service calls |
| Global state | `contexts/` | API keys, language, gallery, viewer |
| API routing | `services/imageEditingService.ts` | Unified facade: prefix → provider |
| Text generation | `services/textService.ts` | Facade with same routing pattern |
| Gemini prompts | `services/gemini/*.ts` | Prompt templates + SDK calls |
| Model configs | `utils/localModels.ts`, `utils/antiModels.ts` | Available models per provider |
| Prompt building | `utils/lookbookPromptBuilder.ts` | Pure functions, no side effects |
| Image helpers | `utils/imageUtils.ts` | Dimensions, compression, base64 |
| Tests | `__tests__/` | Mirrors source structure |
| Translations | `locales/en.ts` | Source of truth; `useLanguage().t('key.path')` |
| Standards | `docs/code-standards.md` | React/TS conventions |

## PROVIDER ROUTING
```typescript
// Model prefix determines provider (imageEditingService.ts, textService.ts)
const LOCAL_PREFIX = 'local--';   // → localProviderService (REST)
const ANTI_PREFIX  = 'anti--';    // → antiProviderService (REST)
// No prefix / gemini-*            → Gemini SDK (default)
```

## PROVIDER STACK (App.tsx)
```
LanguageProvider → ApiProvider → ImageGalleryProvider → ImageViewerProvider → App
```

## CONVENTIONS
- Code at repo root (no `src/`); imports use `@/` alias mapped to root.
- Components are thin UI; hooks hold ALL logic.
- Tailwind 4 via PostCSS. Dark theme: zinc palette + amber accents.
- React.lazy for all feature components + modals; Suspense with fallback.
- `lodash-es` (tree-shakeable) — never `lodash`.
- i18n: `useLanguage().t('key.path')`. Default language: `vi`. Source: `locales/en.ts`.
- Error messages use i18n keys: `error.api.*`. Centralized via `getErrorMessage(err, t)`.
- localStorage for settings (API keys, models); gallery is session-only (in-memory LRU cache).
- Debounced localStorage writes (1000ms).
- Canvas cleanup in `useEffect` return (cancelAnimationFrame, clearRect).
- Production build drops `console.log/debug/info` via esbuild.

## ANTI-PATTERNS (THIS PROJECT)
- Never put logic in components — extract to hooks.
- Never call external APIs from hooks — use service facades.
- Never store state in services — use contexts.
- Never hardcode API keys — use `ApiProviderContext` + localStorage.
- Never use markdown TODOs — use `bd` (beads) issues.
- Canvas operations must clean up in `useEffect` return.
- Never use `lodash` — use `lodash-es` for tree-shaking.

## COMMANDS
```bash
npm run dev                       # Dev server @ localhost:3000
npm run build                     # Production build (+ typechecks)
npm run test                      # Vitest all tests
npm run test -- path/to/file      # Single test file
npm run lint                      # ESLint .ts/.tsx
npm run test:ui                   # Vitest browser UI
npm run test:local-models         # Local provider smoke test
npm run test:local-features       # Local feature smoke test
```

## TESTING
- Framework: Vitest + React Testing Library + jsdom
- Setup: `setupTests.ts` (registers `@testing-library/jest-dom`)
- Mocks: `__tests__/__mocks__/` (axios, `@google/genai`, contexts)
- Coverage thresholds: Statements 80%, Branches 75%, Functions 80%, Lines 80%
- Current coverage: ~53% (below thresholds)

## CCS AUTO-DELEGATION

Delegate to CCS for deterministic tasks:
- Typo fixes, formatting, code cleanup
- Add/update tests (NOT debugging)
- Simple refactors (rename, extract, inline)
- Documentation updates

**DO NOT delegate**: bug investigation, architecture, security, performance.
**Execution**: `use ccs --glm [task]`

## ISSUE TRACKING (BEADS)

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
