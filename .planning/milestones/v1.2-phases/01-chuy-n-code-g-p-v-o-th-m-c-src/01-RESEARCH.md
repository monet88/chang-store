# Phase 1: Chuyển code gộp vào thư mục src/ - Research

**Researched:** 2026-03-24
**Domain:** React 19 + TypeScript runtime tree relocation into `src/`
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Move the full runtime tree into `src/` in one pass: entry files, components, hooks, contexts, services, utils, locales, config, shared types, and app-only helpers.
- Keep `__tests__/` and `setupTests.ts` at repo root for this phase.
- Preserve the current technical-slice layout inside `src/` instead of reorganizing by feature.
- Retarget `@` so it resolves to `src/`.
- Prefer relative imports for nearby modules and `@/` imports for cross-folder references inside the app.
- Point runtime entry wiring directly at files inside `src/`; do not keep root-level bridge runtime files in the end state.
- Remove old root-level runtime source copies after the migration so runtime code has one source of truth.
- Update directly affected configs and docs, explicitly including `AGENTS.md`, `CLAUDE.md`, and stale directory-level `AGENTS.md` guidance.

### the agent's Discretion
- Exact move sequence and batching.
- Exact import rewrite mechanics.
- Exact doc sync scope beyond the explicitly named files, as long as stale source-root guidance is removed.

### Deferred Ideas
- Feature-based reorganization after the move.
- Moving tests under `src/`.
- Unrelated cleanup outside the path migration.
</user_constraints>

<research_summary>
## Summary

This phase is primarily a source-root cutover, not a behavioral refactor. The repo already has a clean technical-slice structure at the root: `components/`, `hooks/`, `contexts/`, `services/`, `utils/`, `locales/`, and `config/`. If those directories move together under `src/`, most intra-app relative imports can stay intact because the directory relationships do not change. The real breakpoints are concentrated in four places:

1. Root entry and shared files: `index.tsx`, `App.tsx`, `types.ts`, `Spinner.tsx`, and `src/index.css`
2. Tooling and build/test alias surfaces: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, and `index.html`
3. Repo-root tests and mocks: `__tests__/**/*` currently import runtime files through root-relative paths like `../../components/...`
4. Docs and agent guidance that explicitly say source lives at repo root or that `@` maps to repo root

Key planning implication: treat the migration as one integrated refactor plan with ordered tasks inside it, not as multiple independent code plans. Splitting the move across separate implementation plans would create awkward temporary bridge states or duplicate source ownership, which conflicts with the phase boundary.

**Primary recommendation:** execute this phase as one plan with four internal tasks: runtime move, config/test retarget, docs/agent sync, and full validation.
</research_summary>

<standard_stack>
## Standard Stack

No new dependencies are needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.3 | SPA runtime | Existing app runtime |
| typescript | 5.8.3 | Module resolution and strict typing | Existing compile gate for path changes |
| vite | 6.4.1 | App entry/build pipeline | Owns aliasing and browser entry wiring |
| vitest | 4.0.17 | Test runner for path-regression checks | Existing test harness for repo-root tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 | Component regression tests | Existing path-sensitive component tests |
| eslint | 9.39.2 | Import/path lint gate | Confirms migration does not introduce syntax regressions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One-pass move into `src/` | Bridge files at repo root | Violates the desired end state and prolongs dual-source risk |
| Whole-tree move | Per-directory staged migration across plans | Creates brittle intermediate path states and more import churn |
| Existing Vite/Vitest/TS config | New monorepo-style source root abstraction | Extra complexity with no product value for this refactor |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Whole-Tree Relocation Preserving Relative Topology
Move source directories together so paths like `../utils/...` and `../contexts/...` remain valid after relocation.

### Pattern 2: Explicit Entry Cutover
Make `src/index.tsx` the browser module entry and `src/App.tsx` the runtime shell. `index.html` should point directly at `/src/index.tsx`.

### Pattern 3: Repo-Root Tests Target `src/`
Keep tests at repo root, but rewrite imports and mocks so they target `../../src/...` or `@/...` against the new alias contract.

### Pattern 4: Documentation Follows the New Source Root
Any doc or agent instruction that says source lives at repo root, that `src/` is CSS-only, or that `@` maps to repo root must be updated in the same phase.

### Anti-Patterns to Avoid
- Partial migration that leaves both `components/` and `src/components/` active
- Temporary bridge runtime files kept after the move
- Retargeting `@` in only one tool surface and forgetting Vite, Vitest, or TypeScript
- Updating code paths without updating repo guidance, leaving future agents pointed at the wrong tree
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Import rewrite strategy | Ad-hoc mixed alias conventions | Existing repo rule: relative for nearby modules, `@/` for cross-folder app imports | Keeps the new tree coherent |
| Test migration | New test harness | Existing Vitest + RTL setup at repo root | The phase only needs path retargeting |
| Source layout redesign | Feature/domain restructure | Current technical-slice tree under `src/` | Keeps the phase structural only |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Browser entry updated, but test/build aliases still point at repo root
**What goes wrong:** app compiles partially or tests still import stale root paths.
**How to avoid:** retarget `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `index.html` together.

### Pitfall 2: Repo-root tests keep old relative imports
**What goes wrong:** tests fail immediately after the move because mocks still target `../../components/...`, `../../hooks/...`, and similar root paths.
**How to avoid:** include `__tests__/**/*` in the migration scope and rewrite all source imports/mocks to `../../src/...` or `@/...`.

### Pitfall 3: Directory-level AGENTS guidance gets stranded
**What goes wrong:** future work still reads `components/AGENTS.md` at the wrong path or follows stale path examples.
**How to avoid:** move/update directory-level AGENTS files with their parent source trees and sync top-level docs in the same phase.

### Pitfall 4: Mixed-root docs linger after code passes
**What goes wrong:** the runtime is under `src/`, but `AGENTS.md`, `CLAUDE.md`, and `docs/codebase-summary.md` still describe repo-root source.
**How to avoid:** make doc sync a first-class task with grep-verifiable stale-string cleanup.
</common_pitfalls>

<code_examples>
## Verified Repo Findings

### Browser entry still points at repo root
```html
<!-- index.html -->
<script type="module" src="/index.tsx"></script>
```

### Root runtime entry still imports CSS from the old special-case location
```typescript
// index.tsx
import App from './App';
import './src/index.css';
```

### TypeScript and Vite aliases still point at repo root
```typescript
// tsconfig.json
"@/*": ["./*"]

// vite.config.ts / vitest.config.ts
'@': path.resolve(__dirname, '.')
```

### Repo-root tests hard-code root-relative runtime imports
```typescript
// __tests__/components/VirtualTryOn.test.tsx
vi.mock('../../hooks/useVirtualTryOn', ...)
import VirtualTryOn from '../../components/VirtualTryOn';
```
</code_examples>

<open_questions>
## Open Questions

None. The phase boundary and migration rules are already specific enough to plan directly.
</open_questions>

<validation_architecture>
## Validation Architecture

Fastest reliable validation stack for this refactor:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test -- VirtualTryOn ClothingTransfer useVirtualTryOn useClothingTransfer`
- `npm run test`
- `npm run build`

Validation needs to prove:
- runtime entry loads from `src/`
- `@` resolves to `src/` in TypeScript, Vite, and Vitest
- repo-root tests correctly import the moved runtime tree
- no stale root runtime source remains in active use
- docs no longer claim source lives at repo root
</validation_architecture>

<sources>
## Sources

### Primary (HIGH confidence)
- `F:\CodeBase\Chang-Store\AGENTS.md`
- `F:\CodeBase\Chang-Store\CLAUDE.md`
- `F:\CodeBase\Chang-Store\README.md`
- `F:\CodeBase\Chang-Store\.planning\ROADMAP.md`
- `F:\CodeBase\Chang-Store\.planning\STATE.md`
- `F:\CodeBase\Chang-Store\.planning\phases\01-chuy-n-code-g-p-v-o-th-m-c-src\01-CONTEXT.md`
- `F:\CodeBase\Chang-Store\.planning\codebase\STRUCTURE.md`
- `F:\CodeBase\Chang-Store\.planning\codebase\STACK.md`
- `F:\CodeBase\Chang-Store\docs\code-standards.md`
- `F:\CodeBase\Chang-Store\components\AGENTS.md`
- `F:\CodeBase\Chang-Store\__tests__\AGENTS.md`
- `F:\CodeBase\Chang-Store\index.html`
- `F:\CodeBase\Chang-Store\index.tsx`
- `F:\CodeBase\Chang-Store\App.tsx`
- `F:\CodeBase\Chang-Store\tsconfig.json`
- `F:\CodeBase\Chang-Store\vite.config.ts`
- `F:\CodeBase\Chang-Store\vitest.config.ts`

### Secondary (MEDIUM confidence)
- `F:\CodeBase\Chang-Store\docs\codebase-summary.md`
- `F:\CodeBase\Chang-Store\docs\design-guidelines.md`
- `F:\CodeBase\Chang-Store\__tests__\components\VirtualTryOn.test.tsx`
- `F:\CodeBase\Chang-Store\__tests__\hooks\useVirtualTryOn.test.tsx`
</sources>

<metadata>
## Metadata

**Research scope:**
- source-root relocation
- entry/config alias cutover
- repo-root test retargeting
- docs and agent guidance sync

**Research date:** 2026-03-24
**Valid until:** 2026-04-24
</metadata>

---

*Phase: 01-chuy-n-code-g-p-v-o-th-m-c-src*
*Research completed: 2026-03-24*
*Ready for planning: yes*
