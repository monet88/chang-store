# Phase 1: Chuyển code gộp vào thư mục src/ - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md`; this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 01-chuy-n-code-g-p-v-o-th-m-c-src
**Areas discussed:** Migration scope, Import contract, Cutover and cleanup policy

---

## Migration scope

### What should Phase 1 move into `src/`?

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime root | Move all application runtime code into `src/` in one pass: entry files, screens, hooks, contexts, services, utils, locales, config, shared types, and app-only helpers; keep tooling/docs/build files at repo root. | ✓ |
| Feature folders only | Move the main source directories but leave `App.tsx`, `index.tsx`, `types.ts`, and similar root files where they are for now. | |
| Minimal subset | Move only the most obvious directories first and leave much of the root structure in place for a later cleanup phase. | |

**User's choice:** Runtime root
**Notes:** The move should make `src/` the real runtime root instead of leaving important app wiring behind at repo root.

### How should tests and test support be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep tests at root | Treat `__tests__/` as test infrastructure, not runtime source; update paths/config as needed but avoid moving every test file in the same refactor. | ✓ |
| Move tests into src | Put `__tests__/` and setup files under `src/` too so nearly all code lives under one tree. | |
| Move setup only | Move only app-adjacent test support like `setupTests.ts`, while leaving test suites where they are. | |

**User's choice:** Keep tests at root
**Notes:** Test path updates are acceptable, but test relocation is out of scope for this phase.

### What structure should `src/` use after the move?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror current folders | Keep the current directory boundaries (`components/`, `hooks/`, `contexts/`, `services/`, etc.) and focus this phase on relocation, not redesign. | ✓ |
| Reorganize by feature | Use this phase to regroup folders around feature domains instead of current technical slices. | |
| Hybrid cleanup | Mostly mirror current folders, but allow a few obvious structural cleanups during the move. | |

**User's choice:** Mirror current folders
**Notes:** The phase should stay structural and avoid mixing in a broader architecture redesign.

---

## Import contract

### After the migration, what should `@` point to?

| Option | Description | Selected |
|--------|-------------|----------|
| Point @ to src | Make `src/` the actual app root so `@/components/...` and similar paths resolve inside `src/`. | ✓ |
| Keep @ at repo root | Move files into `src/`, but keep the alias behavior broad so root-level paths still resolve. | |
| Avoid alias change | Keep current aliasing and rely mostly on relative imports after the move. | |

**User's choice:** Point @ to src
**Notes:** `src/` should become the canonical app root rather than a partial container.

### What import style should become the standard?

| Option | Description | Selected |
|--------|-------------|----------|
| Alias for non-local | Use relative imports for nearby files, but use `@/…` for cross-folder imports so moved code stays stable. | ✓ |
| Mostly relative | Prefer relative paths almost everywhere, even across folders inside `src/`. | |
| Alias everywhere | Use `@/…` for most imports, including many same-feature imports. | |

**User's choice:** Alias for non-local
**Notes:** The import contract should stay readable without overusing deep relative paths.

### How should runtime entry files behave after the move?

| Option | Description | Selected |
|--------|-------------|----------|
| Point directly into src | Have the browser/test entrypoints import the real files from `src/` instead of keeping root-level bridge modules. | ✓ |
| Keep root bridges | Leave thin root wrapper files in place temporarily so the move is less disruptive to existing paths. | |
| Keep current entry layout | Move feature folders only and leave runtime entry wiring basically as it is. | |

**User's choice:** Point directly into src
**Notes:** Root-level entry bridges are not part of the desired end state.

---

## Cutover and cleanup policy

### How should the migration land?

| Option | Description | Selected |
|--------|-------------|----------|
| One-pass cutover | Move the runtime tree, update imports/config, and make the new `src/` layout the only supported structure in this phase. | ✓ |
| Staged migration | Allow temporary compatibility bridges so some code can still resolve through old root paths for a while. | |
| Minimal landing | Move files first and leave broader cleanup for a follow-up phase. | |

**User's choice:** One-pass cutover
**Notes:** The phase should end with a single supported runtime layout.

### What should happen to the old runtime files at repo root?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove old runtime copies | Do not keep duplicate root implementations; once moved, the runtime source of truth lives only under `src/`. | ✓ |
| Keep thin wrappers | Leave temporary re-export or bridge files at the root to reduce disruption. | |
| Keep old files for now | Preserve the old root files until a later cleanup phase. | |

**User's choice:** Remove old runtime copies
**Notes:** The move should leave one source of truth rather than duplicate runtime code.

### How much supporting cleanup belongs in the same phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Required config and docs only | Update the configs, scripts, and directly affected docs needed to keep the repo accurate and build/test flow working after the move. | ✓ |
| Config only | Update build/test/tooling paths, but leave documentation cleanup for later. | |
| Broader opportunistic cleanup | Use this refactor to also fold in unrelated cleanup while touching the same files. | |

**User's choice:** Required config and docs only
**Notes:** Supporting churn should stay limited to whatever the relocation actually breaks or invalidates.

---

## the agent's Discretion

- Exact sequencing of folder moves and import rewrites.
- Exact command/tooling update order, as long as the final import contract and cutover policy match the decisions above.

## Deferred Ideas

- Feature-based reorganization after the relocation phase.
- Moving the repo-root test tree into `src/` in a later cleanup phase.
- Unrelated cleanup work beyond what the path migration directly requires.
