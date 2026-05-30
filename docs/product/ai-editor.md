# AI Editor

## Purpose

Free-form image editing via natural language prompts. Users upload images
and describe edits using text, with optional @mention syntax to reference
specific images.

## Behavior

1. User uploads one or more images.
2. User types an editing prompt (e.g., "make the sky sunset orange").
3. Optional: use `@img1`, `@img2` syntax to reference specific uploaded images.
4. AI applies the described edit and returns the result.

## @Mention System

- `@img1` references the first uploaded image, `@img2` the second, etc.
- Invalid references (out of range) are detected and reported.
- When mentions are present, only mentioned images are sent to the API.
- When no mentions exist, all uploaded images are sent.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Images | Yes | One or more photos to edit |
| Prompt | Yes | Natural language edit instruction |
| Aspect ratio | No | Output dimensions |
| Resolution | No | Output quality |

## Key Files

- `src/components/AIEditor.tsx` — UI
- `src/hooks/useAIEditor.ts` — logic + state
- `src/components/MentionTextarea.tsx` — textarea with @mention support

## Validation Path

- Upload image → type prompt → generate → edited image returned
- @mention: upload 3 images → type "@img2 remove background" → only img2 edited
- Invalid @mention → error shown, generation blocked
