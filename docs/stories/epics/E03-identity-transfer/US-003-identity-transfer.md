# US-003 Identity Transfer Batch Feature

## Status

implemented

## Lane

normal

## Intake

- Intake type: Spec slice.
- Intake id: `147`.
- Risk flags: Public contracts.
- Reason for normal lane: adds a bounded Gemini-studio workflow while reusing
  the existing image-edit service contract and provider boundary unchanged.

## Product Contract

Identity Transfer applies one shared facial identity and optional shared body
morphology to a batch of destination images while the destination remains the
authority for pose, performance, outfit, camera, lighting, composition, and
scene. Each destination is one isolated Gemini edit job and returns one result.

## Relevant Product Docs

- `docs/product/identity-transfer.md`
- `docs/product/overview.md`
- `docs/product/provider-studios.md`

## Acceptance Criteria

- A required Face Reference and optional Body Reference are shared across all
  destination images.
- Empty background instructions preserve each destination background; non-empty
  instructions replace it. Extra instructions cannot override reference roles.
- One edit request with one requested output runs per destination, with at most
  four active requests and larger batches queued.
- Item success/error state is isolated and one item can be regenerated without
  changing siblings.
- Identity Transfer is Gemini-only and has mirrored English/Vietnamese UI copy.
- Prompt-builder tests prove authority ordering and preservation invariants;
  hook tests prove batch orchestration and failure isolation.

## Design Notes

- Commands: focused Vitest, TypeScript, lint, build, `git diff --check`.
- API: existing `imageEditingService.editImage` facade only.
- Domain rules: destination performance wins; Face Reference owns identity/hair;
  Body Reference owns morphology only.
- UI surfaces: Gemini navigation, Identity Transfer workspace, result grid.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Pure prompt-builder branch/invariant tests. |
| Integration | Hook test with mocked Gemini boundary for batch orchestration. |
| E2E | Not required by issue #150 V1 testing decisions. |
| Platform | N/A. |
| Release | Typecheck, lint, build, diff check. |

## Harness Delta

No Harness behavior change is expected.

## Evidence

- `npx vitest run __tests__/utils/identity-transfer-prompt-builder.test.ts __tests__/hooks/useIdentityTransfer.test.tsx __tests__/config/modelSelectionRules.test.ts __tests__/components/Tabs.test.tsx __tests__/App.test.tsx` — 5 files / 27 tests passed.
- `npx vitest run --passWithNoTests` — 73 files / 761 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.
- Final code review against repository standards and GitHub issue #150 found no remaining findings.
