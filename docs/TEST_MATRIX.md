# Test Matrix

This file is the human-readable proof map. Durable story proof is stored in
SQLite and queried with the Windows Harness executable:

~~~powershell
.\\scripts\\bin\\harness-cli.exe query matrix --active --summary
~~~

## Validation commands

For the current React/Vite source:

~~~powershell
npx tsc --noEmit
npm run lint
npx vitest run --passWithNoTests
npm run build
~~~

The package test wrapper currently invokes scripts/check-node-platform.mjs,
which is absent from this checkout after the tooling retirement. Therefore
npm run test and npm run check:platform are not represented as passing current
proof until that code/tooling drift is handled in a separate change. The
tracked __tests__/scripts/e2e-live-config.test.ts also imports the retired
scripts/e2e-live/config module; the direct Vitest run reached 745 passing tests
and 1 failed suite for that missing module, and npx tsc reports the same error.

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
