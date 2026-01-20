# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-14
**Commit:** 77963c0
**Branch:** main

## OVERVIEW
Chang-Store is a React 19 + Vite SPA. Core flow: Component UI → Hook logic → Service API → external providers (Gemini, AIVideoAuto).

## STRUCTURE
```
./
├── App.tsx / index.tsx         # App entry
├── components/                 # UI-only components
├── hooks/                      # Feature logic
├── contexts/                   # Global state + providers
├── services/                   # API adapters + provider routing
├── utils/                      # Helpers, prompt builders
├── locales/                    # i18n dictionaries
├── __tests__/                  # Vitest tests + mocks
├── docs/                       # Architecture + standards
└── plans/                      # Plans/reports
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|------|
| UI layout | `components/` | UI-only, no business logic |
| Feature logic | `hooks/` | All mutations/state live here |
| Global state | `contexts/` | Providers + shared state |
| API calls | `services/` | Route models + error handling |
| Model routing | `services/` | `gemini-*` → Gemini, `aivideoauto--*` → AIVideoAuto |
| Prompts/helpers | `utils/` | Prompt builders + helpers |
| Tests/mocks | `__tests__/` | Vitest + mocks |
| Translations | `locales/` | Use `useLanguage()` |
| Standards | `docs/` | code-standards + architecture |

## CODE MAP
LSP workspace symbol map unavailable in this environment. Use the structure table above and `docs/codebase-summary.md` for navigation.

## CONVENTIONS
- Code lives at repo root (no `src/`), imports use `@/` alias to root.
- Hooks hold all logic; components are thin UI wrappers.
- Tailwind 4, React.lazy for feature loading.
- Gallery is in-memory only (no persistence).
- Vitest with coverage thresholds (80%/75%).

## ANTI-PATTERNS (THIS PROJECT)
- Never put logic in components (extract to hooks).
- Never use markdown TODOs; use `bd` issues instead.
- Canvas operations must clean up in `useEffect` return.
- Do not call external APIs directly from hooks (use services).

## CCS AUTO-DELEGATION

Automatically delegate to CCS for deterministic tasks:
- Typo fixes, formatting
- Add/update tests (NOT debugging failing tests)
- Simple refactors (rename, extract, inline)
- Documentation updates
- Code cleanup (remove dead code, unused imports)

**Execution**: `use ccs --glm [task]`

**DO NOT delegate**:
- Bug investigation
- Architecture decisions
- Security-related code
- Performance optimization

## UNIQUE STYLES
- API keys/models managed via `ApiProviderContext` and localStorage sync.

## COMMANDS
```bash
npm run dev          # Dev server @ localhost:3000
npm run build        # Production build (also typechecks)
npm run test         # Vitest all tests
npm run test -- path/to/file.test.ts  # Single test file
npm run lint         # ESLint
```

## NOTES
- Status updates are often polled; UI expects progress callbacks.
- Video features rely on AIVideoAuto models.

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
