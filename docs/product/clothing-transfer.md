# Clothing Transfer

## Purpose

Transfer clothing from one person/photo onto another subject. Unlike Virtual
Try-On which uses isolated garment images, this works with full outfit photos
where the clothing is being worn.

## Behavior

1. User uploads a source photo (person wearing the desired outfit).
2. User uploads a target subject photo (person to receive the clothing).
3. Optional: extra prompt for styling adjustments.
4. AI transfers the clothing from source onto the target subject.

## Difference from Virtual Try-On

| Aspect | Virtual Try-On | Clothing Transfer |
| --- | --- | --- |
| Clothing input | Isolated garment photo | Full person wearing outfit |
| Use case | Product photos, flat-lays | Street style, outfit copying |
| Prompt builder | `virtual-try-on-prompt-builder` | `gemini-clothing-transfer-prompt` / `gpt-clothing-transfer-prompt` |

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Source image | Yes | Person wearing desired outfit |
| Target image | Yes | Person to dress |
| Extra prompt | No | Additional styling instructions |
| Aspect ratio | No | Output dimensions |
| Resolution | No | Output quality |

## Key Files

- `src/components/ClothingTransfer.tsx` — UI
- `src/hooks/useClothingTransfer.ts` — logic + state
- `src/utils/gemini-clothing-transfer-prompt.ts` — Gemini prompt policy
- `src/utils/gpt-clothing-transfer-prompt.ts` — GPT Image prompt policy

## Validation Path

- Upload source + target → generate → target wearing source's outfit
- Extra prompt modifies styling while preserving transfer
