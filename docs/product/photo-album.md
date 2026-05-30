# Photo Album

## Purpose

Batch-generate themed photo sets with configurable poses, backgrounds,
hair styles, skin tones, and framing options.

## Behavior

1. User uploads a subject photo.
2. User selects from configurable options: poses, backgrounds, frames,
   hair styles, skin tones.
3. AI generates a set of photos matching the selected combinations.
4. Progress is tracked with a progress indicator (progress/total).
5. Results can be downloaded individually or as ZIP.

## Configuration Options

| Option | Source | Description |
| --- | --- | --- |
| Poses | `PHOTO_ALBUM_POSES` config | Predefined pose IDs with labels |
| Backgrounds | `PHOTO_ALBUM_BACKGROUNDS` config | Predefined background prompts |
| Frames | i18n `photoAlbum.frames` | Framing/crop options |
| Hair styles | i18n `photoAlbum.hairStyles` | Hair style variations |
| Skin tones | i18n `photoAlbum.skinTones` | Skin tone adjustments |

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Subject image | Yes | Person photo |
| Selected poses | Yes | One or more pose IDs |
| Selected background | Yes | Background preset or custom |
| Frame | No | Crop/framing style |
| Hair style | No | Hair variation |
| Skin tone | No | Skin tone adjustment |

## Key Files

- `src/components/PhotoAlbumCreator.tsx` — UI
- `src/hooks/usePhotoAlbum.ts` — logic + state
- `src/utils/photoAlbumConfig.ts` — poses and backgrounds config

## Validation Path

- Upload subject → select poses + background → generate → album set returned
- Progress indicator shows generation progress
- Transferred images from other features are consumed on mount
