## Implementation Note — docs backfill and codebase resync

- Decision not in the backup story: preserve the current `AGENTS.md` and Harness operating documents installed by the Windows Harness migration; restore only missing public application documentation from `.harness-backup/20260716162737`.
- Decision not in the backup story: exclude `docs/deploy/`, `docs/superpowers/`, ignored image fixtures, and retired tooling/scripts from the recovery set because the current checkout intentionally treats those as local or retired surfaces.
- Deviation: the backup story’s `scripts/harness`, `scripts/e2e-live/*`, and `scripts/provider-tryon-smoke.ts` references must be rewritten to the current Windows CLI and current test inventory; the retired files will not be recreated by this docs task.
- Tradeoff: retain historical E2E results as dated evidence where useful, but do not present the retired runner or its old result as a currently runnable validation path.
- Open risk: `package.json` still references the deleted `scripts/check-node-platform.mjs`, and the tracked `__tests__/scripts/e2e-live-config.test.ts` still imports the deleted `scripts/e2e-live/config`; this task documents the current state but does not change application/tooling code without a separate request.
- Review fix: make `docs/ARCHITECTURE.md` lead with the actual consumer SPA,
  add the provider parity matrix, and explicitly label the upstream Harness
  Rust structure as guidance rather than current repository content.
- Review fix: update the PDR and deployment/dual-boot docs so provider scope and
  current validation commands agree with the source/tooling state.
