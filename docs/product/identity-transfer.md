# Identity Transfer

## Purpose

Identity Transfer applies one shared person identity to one or more destination
images. It is a Gemini-only image-edit workflow. Every destination is processed
as an independent job and produces one result.

## Inputs

- **Destination Images** — one or more images processed as a batch.
- **Face Reference** — required and shared by the whole batch. Pre-filled with
  the built-in default face on mount; uploading another image replaces it.
- **Body Reference** — optional and shared by the whole batch. Pre-filled with
  the built-in default body on mount; clearing it keeps each destination body.
- **Background** — optional shared replacement description.
- **Extra Instructions** — optional shared detail instructions.
- Standard image-edit aspect ratio and resolution controls.

The built-in references are `docs/images/FACE.png` and
`docs/images/BODY.png`, loaded once per page session through the same
compression pipeline as a user upload
(`src/utils/identity-transfer-defaults.ts`). A user upload or clear made before
the default resolves always wins over the late default.

The built-in Face Reference is a 3x3 labelled contact sheet of one person:
front view, left and right profile (90°), left and right three-quarter, slight
downward and upward gaze, and serious and neutral expressions.

## Authority Contract

The destination image owns the photographed moment and remains authoritative
for pose and skeleton placement, head yaw/pitch/roll, gaze, expression, mouth
state, outfit/accessories, crop/composition, camera perspective, lighting, and
scene.

The Face Reference owns **stable facial identity and hair only**. It must not
drive head pose, face angle, gaze, expression, mouth state, camera angle, or
framing. The model reconstructs that identity inside the exact destination
performance rather than copying the reference face pose.

The Face Reference may be a single photograph or a multi-panel contact sheet of
one person at several head angles. A multi-panel reference is read as one single
identity: identity and hair come from the panel whose head angle is closest to
the destination head angle, and the panel layout, borders, gutters, repeated
frames, and panel count are never reproduced. One destination still returns one
image.

When supplied, the Body Reference owns **body morphology, silhouette, and proportions**.
The subject is actively reshaped to match the reference body rather than preserving the
destination body shape. It must not drive pose, posture, stance, or limb placement.
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
absent from GPT Image provider workflows.

## Key Files

- `src/components/IdentityTransfer.tsx`
- `src/hooks/useIdentityTransfer.ts`
- `src/utils/identity-transfer-defaults.ts`
- `src/utils/identity-transfer-prompt-builder.ts`
- `__tests__/hooks/useIdentityTransfer.test.tsx`
- `__tests__/utils/identity-transfer-prompt-builder.test.ts`

## Validation Path

Upload a Face Reference and more than four destinations, optionally add a Body
Reference/background/extra instructions, then generate. Results should appear
independently per destination, failures should remain isolated, and regenerating
one item should leave all siblings unchanged.
