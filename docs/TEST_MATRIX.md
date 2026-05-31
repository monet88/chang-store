# Test Matrix

This file maps product behavior to proof. Durable story proof lives in
`harness.db` and is queried with `scripts/harness query matrix`; this markdown is
a human-readable mirror from the 2026-05-31 docs resync.

## Status Values

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
| US-001-three-provider-studios | Three provider studios | no | no | no | no | planned | Plan remediation only; implementation and runtime verification pending. |
| US-002-docs-backfill-resync | Docs backfill and codebase resync | no | no | no | no | implemented | Docs-only resync done. `provider-studios.md` added; `HARNESS_COMPONENTS` inventory matches `git ls-files`; overview/README de-Gemini-only-ed; dead code flagged in backlog #2. See `docs/CHANGELOG.md` 2026-05-31. |

## Evidence Rules

- Unit proof covers pure domain and application rules.
- Integration proof covers backend enforcement, data integrity, provider behavior,
  jobs, or service contracts.
- E2E proof covers user-visible browser flows.
- Platform proof covers only shell, deployment, mobile, desktop, or runtime
  behavior that cannot be proven in lower layers.
- A story can be implemented without every proof column if the story packet
  explains why.
