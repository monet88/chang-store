# US-004 Multi-Angle Face Reference Default

## Status

implemented

## Lane

normal

## Intake

- Intake type: Change request.
- Risk flags: Existing behavior, Public contracts, External systems.
- Reason for normal lane: the bundled default asset and the prompt text are
  client-visible and reach the Gemini provider boundary, but the request stays
  inside the existing single-reference contract and `imageEditingService.editImage`
  facade.

## Product Contract

The built-in Face Reference default is a 3x3 contact sheet of one person at nine
head angles (`docs/images/FACE_ANGLES.png`), and the Face Reference part declares
that the reference may be a single photograph or a multi-panel sheet, so the
model takes exactly one identity, selects the panel closest to the destination
head angle, and never reproduces the sheet layout. The bundled Body Reference
default is unchanged (`docs/images/BODY.png`).

## Relevant Product Docs

- `docs/product/identity-transfer.md`
- `docs/stories/epics/E03-identity-transfer/US-003-identity-transfer.md`

## Acceptance Criteria

- The Face Reference default loads `docs/images/FACE_ANGLES.png` through the same
  compression pipeline as a user upload; the Body Reference default stays
  `docs/images/BODY.png`; a user upload or clear before the default resolves still wins.
- The Face Reference part text states that the reference may be one photograph or
  a multi-panel contact sheet of one person, requires one single identity and the
  panel whose head angle is closest to the destination, and forbids reproducing
  the panel layout, borders, gutters, repeated frames, or panel count.
- The task invariants state that a multi-panel Face Reference still yields exactly
  one identity and one output image.
- Existing Face/Body authority and preservation assertions keep passing unchanged.
- `docs/product/identity-transfer.md` names the new default asset and the
  multi-panel read rule.

## Design Notes

- Commands: focused Vitest, `npx tsc --noEmit`, lint, build, `git diff --check`.
- API: existing `imageEditingService.editImage` facade only; still one Face
  Reference part, so no state or service change.
- Domain rules: destination performance wins; Face Reference owns identity and
  hair only; a multi-panel reference never supplies pose, framing, or layout.
- UI surfaces: Gemini Identity Transfer workspace; default face thumbnail only.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Prompt-builder assertions for the reference-format clause and the invariants tail. |
| Integration | Hook tests unchanged plus a manual browser smoke with a real destination upload. |
| E2E | Not required by issue #150 V1 testing decisions. |
| Platform | N/A. |
| Release | Typecheck, lint, build, diff check. |

## Harness Delta

No Harness behavior change is expected.

## Evidence

- `npx vitest run __tests__/utils/identity-transfer-prompt-builder.test.ts __tests__/hooks/useIdentityTransfer.test.tsx` — 2 files / 21 tests passed (new reference-format test included).
- `npx vitest run` — 72 files / 771 tests passed.
- `npx tsc --noEmit` — passed. `npm run lint` — passed. `npm run build` — built in 2.63s. `git diff --check` — clean.
- Manual smoke: Vite dev server on `http://localhost:3549/` in the Orca built-in browser. The Identity Transfer face thumbnail is `data:image/jpeg` of 1254x1254 whose top rows contain dark hair pixels (`darkTop4=107`), which is the angle-sheet signature; the old asset had backdrop headroom there. The body thumbnail stays 1448x1086 (`BODY.png`), `darkTop4=0`.
