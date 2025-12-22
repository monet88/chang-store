# Repository Guidelines

## Project Structure & Module Organization
- This is a Vite + React + TypeScript SPA. Entry points are `index.html`, `index.tsx`, and `App.tsx` in the repo root.
- UI components live in `components/`; shared logic in `hooks/`, global state in `contexts/`, and cross-cutting helpers in `utils/`.
- API and external integrations belong in `services/`. Text, copy, and localization assets live in `text/` and `locales/`.

## Build, Test, and Development Commands
- Install dependencies: `npm install`
- Run dev server (default on `http://localhost:5173`): `npm run dev`
- Production build: `npm run build`
- Preview built app locally: `npm run preview`
- No test runner is configured yet; add one (e.g., Vitest) before introducing automated tests.

## Coding Style & Naming Conventions
- Use TypeScript with JSX (`.tsx`) and 2-space indentation.
- Name React components with PascalCase (e.g., `ProductGrid.tsx`) and hooks with `use`-prefix in `hooks/` (e.g., `useCart.ts`).
- Keep components presentational in `components/` and move side-effectful or reusable logic into `hooks/`, `contexts/`, or `services/`.
- Use the `@/` alias for root-relative imports instead of long `../` chains.

## Testing Guidelines
- When adding tests, prefer a modern TS-friendly runner (e.g., Vitest + React Testing Library).
- Place tests next to the code under test using `*.test.ts` / `*.test.tsx` naming.
- Aim to cover critical flows (API calls in `services/`, shared hooks, and complex components) before edge cases.

## Commit & Pull Request Guidelines
- Follow a lightweight Conventional Commits style, as in existing history: `feat: Set up project structure and dependencies`.
- Use short, present-tense summaries (e.g., `feat: add cart sidebar`, `fix: handle empty catalog`).
- For PRs, include: purpose, key changes, any breaking behavior, and manual test steps or screenshots for UI changes.

## Security & Configuration
- Store secrets (e.g., `GEMINI_API_KEY`) in `.env.local` only; never commit them.
- Ensure new configuration flags and environment variables are documented in `README.md` or inline docs.

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


<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END BEADS INTEGRATION -->
