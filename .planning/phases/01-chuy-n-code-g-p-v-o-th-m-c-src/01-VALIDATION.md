---
phase: 1
slug: chuyen-code-gop-vao-thu-muc-src
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-24
---

# Phase 01 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript + ESLint + Vitest + Vite build |
| **Quick run command** | `npm run test -- VirtualTryOn ClothingTransfer useVirtualTryOn useClothingTransfer` |
| **Full suite command** | `npm run test` |
| **Build command** | `npm run build` |
| **Lint command** | `npm run lint` |
| **Typecheck command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~3-5 minutes |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | src runtime cutover | structural/typecheck | `npx tsc --noEmit` | `src/index.tsx`, `src/App.tsx`, `src/types.ts` | ○ planned |
| 01-01-02 | 01 | 1 | alias + repo-root test retarget | unit/component | `npm run test -- VirtualTryOn ClothingTransfer useVirtualTryOn useClothingTransfer` | `__tests__/components/VirtualTryOn.test.tsx`, `__tests__/hooks/useVirtualTryOn.test.tsx` | ○ planned |
| 01-01-03 | 01 | 1 | stale root-path cleanup | lint/search | `npm run lint` | `AGENTS.md`, `CLAUDE.md`, `docs/codebase-summary.md` | ○ planned |
| 01-01-04 | 01 | 1 | full migration regression | full regression | `npm run test && npm run build` | moved runtime tree under `src/` | ○ planned |

*Status: ✅ green · ❌ red · ⚠️ flaky · ○ planned*

## Wave 0 Requirements

- Existing build/test infrastructure is already sufficient for this phase.
- No new fixtures, mocks, providers, or backend setup are required before execution.
- The main prerequisite is path retargeting so current tests follow the moved runtime tree.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App still boots from `src/` with the same provider chain | runtime cutover | Browser bootstrap and lazy feature loading are easiest to confirm in a real dev session | Run `npm run dev`, open the app, switch several features, and confirm the shell loads normally |
| Docs and AGENTS guidance point future work at `src/` instead of repo root | doc sync | This is a content-accuracy check, not just a compile check | Read `AGENTS.md`, `CLAUDE.md`, and `docs/codebase-summary.md` after the migration and confirm path guidance matches the new tree |

## Validation Sign-Off

- [x] All tasks have automated verify coverage or explicit manual verification
- [x] Sampling continuity preserved
- [x] Wave 0 dependencies are already available
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution 2026-03-24
