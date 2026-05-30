# Background Replacer

## Purpose

Replace the background of a subject photo using AI, with either a text prompt
or a predefined background preset.

## Behavior

1. User uploads a subject photo.
2. User either types a custom background prompt or selects a predefined preset.
3. Optional: upload a background reference image instead of text.
4. AI generates the subject with the new background.
5. Results can be refined via chat session.

## Background Sources

- **Custom prompt**: Free-text description of desired background.
- **Predefined presets**: Curated list from `photoAlbumConfig.ts` (shared with
  Photo Album feature).
- **Reference image**: Upload a background photo for style transfer.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Subject image | Yes | Person/product photo |
| Background prompt | Yes (or preset) | Text description |
| Predefined key | No | Preset background ID |
| Background image | No | Reference photo |
| Aspect ratio | No | Output dimensions |
| Resolution | No | Output quality |

## Key Files

- `src/components/BackgroundReplacer.tsx` — UI
- `src/hooks/useBackgroundReplacer.ts` — logic + state
- `src/components/PredefinedBackgroundSelector.tsx` — preset picker
- `src/utils/photoAlbumConfig.ts` — shared background presets

## Validation Path

- Upload subject → type prompt → generate → new background applied
- Select predefined → generate → preset background applied
- Switch from predefined to custom preserves user-typed text
