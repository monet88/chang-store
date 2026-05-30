# Lookbook Generator

## Purpose

Generate styled editorial fashion spreads from clothing photos. Produces
main shots, variations, and close-up details in a single generation flow.

## Behavior

1. User uploads clothing images (up to 8 slots).
2. User selects style, garment type, and presentation options.
3. Optional: fabric texture image/prompt, clothing description, negative prompt.
4. AI generates a lookbook set: main image + variations + close-ups.
5. Results can be refined, upscaled, or downloaded as ZIP.

## Lookbook Styles

Configurable via `LookbookStyle` enum — includes editorial, product shot,
mannequin, folded presentation, and more.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Clothing images | Yes | Up to 8 garment photos |
| Lookbook style | Yes | Editorial, product shot, mannequin, etc. |
| Garment type | Yes | Dress, shirt, pants, etc. |
| Fabric texture | No | Reference image or text description |
| Clothing description | No | Auto-generated or manual |
| Negative prompt | No | What to avoid in output |
| Product shot sub-type | No | For product shot style only |

## Output Structure

```
LookbookSet {
  main: ImageFile        — hero shot
  variations: ImageFile[] — alternate angles/styling
  closeups: ImageFile[]   — detail/texture shots
}
```

## Key Files

- `src/components/LookbookGenerator.tsx` — UI + form
- `src/components/LookbookForm.tsx` — form inputs
- `src/components/LookbookOutput.tsx` — results display
- `src/components/LookbookGenerator.prompts.ts` — style/type enums
- `src/hooks/useLookbookGenerator.ts` — logic + state
- `src/utils/lookbookPromptBuilder.ts` — prompt construction
- `src/components/SavedLookbooks.tsx` — saved results

## Validation Path

- Upload clothing → select style → generate → main + variations returned
- Close-up generation produces detail crops
- Draft state persists across sessions via localStorage
