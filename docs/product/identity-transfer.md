# Identity Transfer

## Purpose

Identity Transfer applies one shared person identity to one or more destination
images. It is a Gemini-only image-edit workflow. Every destination is processed
as an independent job and produces one result.

## Inputs

- **Destination Images** — one or more images processed as a batch.
- **Face Reference** — required and shared by the whole batch.
- **Body Reference** — optional and shared by the whole batch.
- **Background** — optional shared replacement description.
- **Extra Instructions** — optional shared detail instructions.
- Standard image-edit aspect ratio and resolution controls.

## Authority Contract

The destination image owns the photographed moment and remains authoritative
for pose and skeleton placement, head yaw/pitch/roll, gaze, expression, mouth
state, outfit/accessories, crop/composition, camera perspective, lighting, and
scene.

The Face Reference owns **stable facial identity and hair only**. It must not
drive head pose, face angle, gaze, expression, mouth state, camera angle, or
framing. The model reconstructs that identity inside the exact destination
performance rather than copying the reference face pose.

When supplied, the Body Reference owns **body morphology and proportions only**.
It must not drive pose, posture, stance, skeleton orientation, or limb placement.
When omitted, the destination body morphology is preserved and body shape is not
inferred from the Face Reference.

If Background is empty, the destination background is preserved. If it is
non-empty, the background is replaced with the shared description while the
destination subject performance and composition remain authoritative. Extra
Instructions are subordinate to all role and preservation rules above.

## Batch Execution

- One `imageEditingService.editImage` request per destination.
- One requested/stored result per destination.
- Maximum four active destination requests at once; larger batches remain
  queued until a worker slot is available.
- Each destination has independent pending/processing/completed/error state.
- A failed destination does not discard successful siblings.
- Regenerate reruns only the selected destination with the current shared
  references and settings.

## Provider Scope

Identity Transfer is available only in the Gemini studio. It is intentionally
absent from Grok and GPT Image provider workflows.

## Key Files

- `src/components/IdentityTransfer.tsx`
- `src/hooks/useIdentityTransfer.ts`
- `src/utils/identity-transfer-prompt-builder.ts`
- `__tests__/hooks/useIdentityTransfer.test.tsx`
- `__tests__/utils/identity-transfer-prompt-builder.test.ts`

## Validation Path

Upload a Face Reference and more than four destinations, optionally add a Body
Reference/background/extra instructions, then generate. Results should appear
independently per destination, failures should remain isolated, and regenerating
one item should leave all siblings unchanged.
