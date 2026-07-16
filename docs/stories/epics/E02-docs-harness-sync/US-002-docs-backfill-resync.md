# US-002 Docs Backfill and Codebase Resync

## Status

implemented

## Lane

normal

## Intake

- Intake type: Maintenance request.
- Intake id: `141` (recorded via `scripts/bin/harness-cli.exe intake`).
- Risk flags: Weak proof.
- Reason for normal lane: docs-only change, no app behavior or contract change,
  but it touches the source-of-truth doc set across multiple domains.

## Product Contract

`docs/` must reflect the **current** chang-store codebase on branch
`fix/vto-multi-person-gateway-validation`, with the code as the source of truth. After this
story:

- Product docs describe all live user-visible surfaces, including the
  three-provider studio split (Gemini / Grok / GPT Image), not only the nine
  Gemini `Feature` enum workflows.
- `docs/HARNESS_COMPONENTS.md` describes the real tracked files of this repo,
  with no leftover inventory rows from the upstream harness template
  (`Cargo.toml`, `crates/harness-cli/*`, `PHASE2.md`, `docs/demo/*`,
  `docs/review-fixes-*.md`, `US-001-install-harness.md`, the
  `E01-durable-layer` / `E02-phase-2-observability-taxonomy` story trees).
- Known dead code (`useSwapFace`, `useInpainting` and their locale strings) is
  explicitly flagged so future agents do not treat it as a live feature.
- Supporting docs (`codebase-summary.md`, `system-architecture.md`,
  `project-roadmap.md`, `README.md`, `CHANGELOG.md`) agree with `src/types.ts`,
  `src/App.tsx`, and the real hook/service inventory.

This story changes **documentation only**. It does not modify, add, or remove
application source code.

## Relevant Product Docs

- `docs/product/overview.md`
- `docs/product/provider-studios.md` (new)
- `docs/product/README.md`
- `docs/HARNESS_COMPONENTS.md`
- `docs/codebase-summary.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- `docs/README.md`
- `docs/CHANGELOG.md`
- `README.md`

## Scope (Tasks A–E)

| Task | Description | Lane impact |
| --- | --- | --- |
| A | Rewrite `HARNESS_COMPONENTS.md` File Inventory + NexAU map to match real tracked files of chang-store; remove upstream-template leftovers. | normal |
| B | Backfill product docs for provider studios: new `docs/product/provider-studios.md`, fix `overview.md` "Gemini-only" claim, update `product/README.md` index. | normal |
| C | Flag `useSwapFace` / `useInpainting` (+ `swapFace`/`inpainting` locale strings) as dead code in docs and record a backlog item for cleanup. | tiny |
| D | Verify and refresh `codebase-summary.md`, `system-architecture.md`, `project-roadmap.md`, `README.md`, `docs/README.md` against the real feature/hook surface. | tiny |
| E | Record durable trace + keep story/test-matrix current via `scripts/bin/harness-cli.exe`. | tiny |

## Acceptance Criteria

- `docs/HARNESS_COMPONENTS.md` File Inventory lists only files that exist in this
  repo (`git ls-files`), and every harness/docs file is mapped to at least one
  responsibility. No row references a nonexistent file.
- A `docs/product/provider-studios.md` exists describing the `StudioMode` split,
  the studio switcher, the five provider workflows, the Grok / GPT Image service
  contracts, the parity matrix vs Gemini, and provider isolation rules.
- `docs/product/overview.md` no longer states the AI backend is "Gemini-only";
  it describes the three-provider model and links to `provider-studios.md`.
- `docs/product/README.md` index includes the provider-studios doc.
- `useSwapFace` and `useInpainting` are documented as absent/unwired code in
  `codebase-summary.md`; no source references remain in the current tree.
- `codebase-summary.md`, `system-architecture.md`, `project-roadmap.md`, and
  `README.md` match `src/types.ts` (9 `Feature` values + `StudioMode`) and the
  current hook/service inventory.
- `docs/CHANGELOG.md` has an entry for this docs resync.
- A trace is recorded with `scripts/bin/harness-cli.exe trace`, and the story row reflects
  final status.

## Design Notes

- Commands: `git ls-files`, `scripts/bin/harness-cli.exe intake|story|trace|query`.
- Queries: `scripts/bin/harness-cli.exe query matrix`.
- API: none (docs-only).
- Tables: `intake`, `story`, `backlog`, `trace`.
- Domain rules: code is source of truth; product docs are the operational
  contract derived from code (see `docs/product/README.md` source hierarchy).
- UI surfaces: documented only, not changed — `StudioModeSwitch`, `GrokStudio`,
  `GptImageStudio`, `provider-studio/*`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | N/A — docs-only; no code changed. |
| Integration | N/A. |
| E2E | N/A. |
| Platform | N/A. |
| Release | Doc cross-checks: feature list vs `src/types.ts`; inventory vs `git ls-files`; provider claims vs `src/config/providerRegistry.ts` and `src/App.tsx`. |

Doc-consistency checks (the proof for this lane):

- Feature list in product docs == `Feature` enum in `src/types.ts`.
- Inventory rows in `HARNESS_COMPONENTS.md` ⊆ tracked files (`git ls-files`).
- Provider studio behavior matches `docs/ARCHITECTURE.md` "Studio Modes" section
  and the real components/hooks/services.
- `useSwapFace` / `useInpainting` confirmed unreferenced by any component or
  `App.tsx` (verified via search: no callers).

## Harness Delta

- Existing epic `E02-docs-harness-sync` continued under intake #141.
- Public application docs were recovered from the dated backup while current
  Harness policy files were preserved.
- Retired runner/tool references were removed or marked historical instead of
  recreating the deleted tooling.

## Evidence

- Intake #141 recorded.
- Story `US-002-docs-backfill-resync` updated in the durable matrix.
- Fresh docs-only proof passed: inventory path check, product-index path check,
  lint, build, scoped Vitest (71 files / 745 tests), and git diff --check.
- Full typecheck and the unfiltered Vitest run remain red because the tracked
  e2e-live-config test imports retired scripts/e2e-live/config; this is an
  existing tooling/test drift outside this docs-only story.
- Remaining command output and changed-file list added at trace time (Task E).
