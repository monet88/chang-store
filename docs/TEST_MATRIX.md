# Test Matrix

This file maps product behavior to proof. Durable story proof lives in
`harness.db` and is queried with the platform-native Harness CLI
(`scripts/bin/harness-cli.exe query matrix` on Windows;
`scripts/harness query matrix` on POSIX); this markdown is
a human-readable mirror, last resynced on 2026-07-16.

## Automated Suite Snapshot (2026-07-16)

`npm run test` runs 751 tests across 72 files (all passing). A live
end-to-end harness (`scripts/e2e-live/run.mts`) additionally drives the real
service layer against the Vertex gateway (`https://vertex.monet.uno/gemini`)
with the `docs/image-test/` samples: 11/13 flows returned valid output, the two
non-passing flows being external-runtime conditions (model refusal on a specific
watermark sample, transient upstream quota), not app defects. See the "Live E2E
Verification" section in `docs/codebase-summary.md`.

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
| US-003-vertex-cli-proxy-toggle | Vertex CLI proxy toggle for Gemini | yes | yes | no | no | implemented | Proxy toggle/settings, direct vs proxy routing, proxy image generateContent path, Gemini 3.5/3.1 model cleanup, and quota fallback warning path implemented. Proof: `__tests__/services/apiClient.test.ts`, `__tests__/contexts/ApiProviderContext.test.tsx`, `__tests__/hooks/useSettingsModal.test.tsx`, `__tests__/components/SettingsModal.test.tsx`, `__tests__/services/gemini/image.test.ts`, `__tests__/services/gemini/text.test.ts`, `__tests__/services/imageEditingService.test.ts`, `__tests__/services/textService.test.ts`; quality gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`. |
| OPS-GEMINI-VISION-CONTENTS | Gemini vision helpers send SDK-valid `contents` through the gateway | yes | no | yes | no | implemented | `contents` shape fixed to `[{ role, parts }]` in `src/services/gemini/text.ts`; the old `{ parts }` shape was rejected by the gateway with `VALIDATION_FAILED`. Proof: `__tests__/services/gemini/text.test.ts` (updated assertions) and live E2E vision-describe flow (`scripts/e2e-live/run.mts`). Gates: `npx tsc --noEmit`, `npm run lint`, `npm run test` (725 pass). |

## Evidence Rules

- Unit proof covers pure domain and application rules.
- Integration proof covers backend enforcement, data integrity, provider behavior,
  jobs, or service contracts.
- E2E proof covers user-visible browser flows.
- Platform proof covers only shell, deployment, mobile, desktop, or runtime
  behavior that cannot be proven in lower layers.
- A story can be implemented without every proof column if the story packet
  explains why.
