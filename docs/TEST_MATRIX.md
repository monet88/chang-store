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
| US-003-vertex-cli-proxy-toggle | Vertex CLI proxy toggle for Gemini | yes | yes | no | no | implemented | Proxy toggle/settings, direct vs proxy routing, proxy image generateContent path, Gemini 3.5/3.1 model cleanup, and quota fallback warning path implemented. Proof: `__tests__/services/apiClient.test.ts`, `__tests__/contexts/ApiProviderContext.test.tsx`, `__tests__/hooks/useSettingsModal.test.tsx`, `__tests__/components/SettingsModal.test.tsx`, `__tests__/services/gemini/image.test.ts`, `__tests__/services/gemini/text.test.ts`, `__tests__/services/imageEditingService.test.ts`, `__tests__/services/textService.test.ts`; quality gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`. |

## Evidence Rules

- Unit proof covers pure domain and application rules.
- Integration proof covers backend enforcement, data integrity, provider behavior,
  jobs, or service contracts.
- E2E proof covers user-visible browser flows.
- Platform proof covers only shell, deployment, mobile, desktop, or runtime
  behavior that cannot be proven in lower layers.
- A story can be implemented without every proof column if the story packet
  explains why.
