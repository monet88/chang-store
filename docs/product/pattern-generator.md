# Pattern Generator

## Purpose

Generate textile and fabric patterns from reference images. Supports iterative
refinement via chat sessions and tiling preview.

## Behavior

1. User uploads reference images (fabric swatches, textures, inspiration).
2. User sets number of pattern variants to generate (1-4).
3. AI generates seamless pattern(s) based on the references.
4. User can preview tiling to verify seamlessness.
5. User can refine selected pattern via chat-based iteration.

## Refinement Flow

Each generated pattern maintains its own chat session. Refinement sends the
current pattern + correction prompt back to the AI for iterative improvement.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| Reference images | Yes | Fabric/texture/inspiration photos |
| Num images | No | 1-4 pattern variants (default 1) |
| Refine prompt | No | Correction for iterative refinement |

## Key Files

- `src/components/PatternGenerator.tsx` — UI
- `src/hooks/usePatternGenerator.ts` — logic + state
- `src/utils/pattern-generator-prompt-builder.ts` — prompt + task prompt

## Validation Path

- Upload reference → generate → pattern(s) returned
- Toggle tiling preview → pattern tiles seamlessly
- Select pattern → type refinement → refined version returned
- Chat session maintains context across refinements
