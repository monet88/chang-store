# Pose Changer

## Purpose

Re-pose a subject using a reference pose image, library poses, or a custom
pose description prompt.

## Behavior

1. User uploads a subject photo.
2. User provides pose input via one of three methods:
   - Upload a pose reference image (AI describes it automatically).
   - Select poses from the built-in pose library.
   - Type a custom pose prompt.
3. User selects camera view (full body, half body, knees up, default).
4. AI generates the subject in the new pose(s).
5. Individual results can be regenerated or upscaled.

## Camera Views

| View | Description |
| --- | --- |
| `default` | AI decides framing |
| `fullBody` | Head to toe |
| `halfBody` | Waist up |
| `kneesUp` | Knees up |

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Subject image | Yes | Person to re-pose |
| Pose reference image | No | Photo showing desired pose |
| Custom pose prompt | No | Text description of pose |
| Library poses | No | Selected from built-in library |
| Camera view | No | Framing preference |
| Negative prompt | No | What to avoid |
| Aspect ratio | No | Output dimensions |
| Resolution | No | Output quality |

## Key Files

- `src/components/PoseChanger.tsx` — UI
- `src/hooks/usePoseChanger.ts` — logic + state
- `src/services/textService.ts` — `generatePoseDescription()` for auto-describe
- `src/components/modals/PoseLibraryModal.tsx` — pose library picker

## Validation Path

- Upload subject + pose reference → generate → re-posed output
- Select library poses → generate → multiple outputs
- Auto-describe: upload reference → description generated → used as prompt
