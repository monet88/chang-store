# Test Matrix

This file is the human-readable proof map and validation commands for the project.

## Validation commands

For the current React/Vite source:

~~~powershell
npx tsc --noEmit
npm run lint
npx vitest run --passWithNoTests
npm run build
~~~

The retired platform wrapper and live-E2E config test are no longer part of the
current checkout. On 2026-09-17, `npx tsc --noEmit`, `npm run lint`, direct
Vitest (73 files / 761 tests), and `npm run build` all passed while validating
US-003 Identity Transfer.

## Status values

| Status | Meaning |
| --- | --- |
| planned | Accepted as intended behavior, not implemented |
| in_progress | Actively being built |
| implemented | Implemented and proof exists |
| changed | Contract changed after earlier implementation |
| retired | No longer part of the product contract |

## Matrix

| Story | Contract | Unit | Integration | E2E | Platform | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-001-three-provider-studios | Three isolated provider studios | no | no | no | no | planned | Story packet exists; implementation/proof status must be verified separately. |
| US-002-docs-backfill-resync | Documentation reflects current source | N/A | N/A | N/A | N/A | implemented | Backup recovery plus source/inventory path checks, lint, build, scoped Vitest, and git diff --check passed. |
| US-003-identity-transfer | Gemini Identity Transfer batch workflow | yes | yes | no | N/A | implemented | Prompt-builder + hook orchestration tests cover role invariants, concurrency, queueing, failure isolation, regenerate, and no-body; full Vitest 73 files / 761 tests, typecheck, lint, build, and diff check passed. |

## Historical evidence

The 2026-07-03 snapshot recorded 725 tests across 70 files and a 11/13
successful live gateway run. The live runner and sample fixtures are not
present in the current checkout, so those numbers remain historical and are
not current passing proof.

## Evidence rules

- Unit proof covers pure domain and application rules.
- Integration proof covers provider behavior and service contracts.
- E2E proof covers user-visible browser flows.
- Platform proof covers shell, deployment, mobile, desktop, or runtime behavior
  that cannot be proven in lower layers.
- A story can be implemented without every proof column if its packet explains
  why.
