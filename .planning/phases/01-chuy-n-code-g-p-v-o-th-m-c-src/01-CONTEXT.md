# Phase 1: Chuyển code gộp vào thư mục src/ - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Relocate the Chang-Store application runtime so `src/` becomes the real source root instead of a CSS-only folder. This phase covers moving runtime code and entry files into `src/`, retargeting import and alias contracts, and updating the required tooling/docs so the app still builds, lints, and tests against the new layout. It does not redesign the feature architecture or add new product capabilities.

</domain>

<decisions>
## Implementation Decisions

### Migration scope
- **D-01:** Move the full application runtime into `src/` in one pass. This includes entry files, screens/components, hooks, contexts, services, utils, locales, config helpers, shared types, and app-only helper modules. Tooling, scripts, docs, and generated artifacts stay at repo root.
- **D-02:** Keep test infrastructure at repo root for this phase. `__tests__/` and `setupTests.ts` should continue to live outside `src/`, with only the path/config updates needed to follow the moved runtime files.
- **D-03:** Preserve the current technical-slice folder layout inside `src/` (`components/`, `hooks/`, `contexts/`, `services/`, `utils/`, `locales/`, `config/`) instead of reorganizing by feature during this refactor.

### Import contract
- **D-04:** Retarget the `@` alias so it resolves to `src/`, making `src/` the canonical application root for imports.
- **D-05:** Standardize on relative imports for nearby modules and `@/…` imports for cross-folder references inside the app.
- **D-06:** Point runtime entry wiring directly at files inside `src/`; do not keep root-level app entry bridge files as part of the end state.

### Cutover and cleanup policy
- **D-07:** Land the migration as a one-pass cutover, not a staged bridge migration.
- **D-08:** Remove old root-level runtime source copies after the move so runtime code has a single source of truth under `src/`.
- **D-09:** Include only the supporting cleanup required to keep the repository accurate and green after the move: configs, scripts, and directly affected docs. This explicitly includes `AGENTS.md`, `CLAUDE.md`, and any directory-level `AGENTS.md` files whose source-root, alias, or path guidance becomes stale after the migration. Do not use this phase for unrelated opportunistic cleanup.

### the agent's Discretion
- Exact folder-by-folder move sequence and batching strategy.
- Exact import rewrite mechanics, as long as the final contract matches the decisions above.
- Any low-risk temporary working order during the refactor, as long as the committed end state leaves runtime code under `src/` with no duplicate root runtime sources.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project instructions and constraints
- `AGENTS.md` — repository workflow constraints, required docs to read first, documentation update rules, and GSD orchestration expectations.
- `CLAUDE.md` — repo-specific architecture, anti-patterns, and required validation commands after substantive code changes.
- `README.md` — product overview, current provider architecture, and runtime stack summary.

### Directory-level agent guidance
- `components/AGENTS.md` — component inventory, `ToastProvider` location, modal/lazy-load patterns, and `App.tsx` integration expectations.
- `contexts/AGENTS.md` — provider stack details, especially that `ToastProvider` is outside `contexts/`.
- `hooks/AGENTS.md` — hook-layer responsibilities that must remain separate from components after the relocation.
- `services/AGENTS.md` — service-facade boundaries and routing expectations that the move must preserve.
- `__tests__/AGENTS.md` — current repo-root test layout that remains intentionally out of `src/` for this phase.

### Architecture and code standards
- `docs/code-standards.md` — code organization, naming, TypeScript, testing, and maintenance expectations the refactor must preserve.
- `docs/system-architecture.md` — current application architecture and provider layering that the refactor must not change.

### Current codebase maps
- `.planning/codebase/CONVENTIONS.md` — current naming, import, error-handling, and testing conventions that should survive the relocation.
- `.planning/codebase/STRUCTURE.md` — current source layout and the explicit note that `src/` is CSS-only today, which this phase is meant to change.
- `.planning/codebase/STACK.md` — current Vite/Vitest/TypeScript alias and tooling surfaces affected by moving the runtime tree.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Root technical-slice directories already map cleanly to the target tree: `components/`, `hooks/`, `contexts/`, `services/`, `utils/`, `locales/`, and `config/`.
- Runtime entry and shared modules are already isolated in a small set of files: `App.tsx`, `index.tsx`, `types.ts`, `Spinner.tsx`, and `src/index.css`.
- `components/Toast.tsx` is a runtime provider module even though it lives outside `contexts/`; the provider chain must still work after the move.
- Tooling surfaces that define path behavior are centralized: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, and `setupTests.ts`.

### Established Patterns
- The application follows the thin component -> hook -> service facade architecture and that structure should remain intact after the move.
- `@` currently resolves to repository root in TypeScript, Vite, and Vitest; this phase intentionally changes that contract to `src/`.
- Feature routing does not use React Router; `App.tsx` / `AppContent` switch on the `Feature` enum to lazy-load the active screen.
- Current runtime imports still assume root-level source folders (for example `./components/...` and `./contexts/...`), so import rewrites are a core part of the migration.
- Tests live under repo-root `__tests__/` and current Vitest coverage globs assume root-level source directories.

### Integration Points
- Browser bootstrap: `index.tsx`, `App.tsx`, and `src/index.css`.
- Provider stack and runtime wiring: `App.tsx`, `contexts/*`, and `components/Toast.tsx`.
- Feature rendering contract: `AppContent` in `App.tsx` and the `Feature` enum in `types.ts`.
- Path and build configuration: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `eslint.config.js`.
- Test/runtime coordination: `setupTests.ts`, `__tests__/`, and any scripts or docs that point at root-level source paths today.

</code_context>

<specifics>
## Specific Ideas

- `src/` should become the true application root, not remain a CSS-only special case.
- Keep this phase structural. Do not combine the move with a feature-based folder redesign.
- Keep repo-root tests in place while the runtime code is consolidated under `src/`.
- Treat the AGENTS/CLAUDE documentation family as explicit sync targets because they now describe current path, alias, provider-stack, and routing facts in more detail than before.

</specifics>

<deferred>
## Deferred Ideas

- Feature/domain-based reorganization after the relocation is complete.
- Moving test suites under `src/` in a future cleanup phase if the team still wants a single consolidated tree.
- Any broader opportunistic cleanup unrelated to path migration.

</deferred>

---

*Phase: 01-chuy-n-code-g-p-v-o-th-m-c-src*
*Context gathered: 2026-03-24*
