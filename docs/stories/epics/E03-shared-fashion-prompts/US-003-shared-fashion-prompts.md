# US-003 Optimize Shared Fashion Prompts for Try-On, Lookbook, and Clothing Transfer

## Status

implemented

## Lane

normal

## Product Contract

Rewrite the shared prompt surface across Virtual Try-On, Lookbook, and Clothing Transfer to use concise, role-driven image-edit contracts following Image Prompt Guide principles without creating provider-specific forks. Preserve all product invariants, request/provider architecture, and existing features.

## Relevant Product Docs

- `docs/product/try-on.md`
- `docs/product/clothing-transfer.md`
- `docs/product/lookbook.md`

## Acceptance Criteria

1. Virtual Try-On prompt enforces source roles, full-look replacement, later-source precedence, non-clothing category isolation, untucked tops, natural fit/occlusion, background keep/replace, multi-person preservation, and preserves supported logos/graphics while prohibiting invented text/branding/graphics.
2. Clothing Transfer prompt establishes an explicit ownership model: destination owns scene, composition, camera, and person identity/pose; source references own garment design and construction only; labeled and unlabeled references extracted accurately with zero source prop/person leakage.
3. Lookbook prompt handles multi-view and multi-piece evidence without blending into hybrid designs or merging distinct garments; fabric texture controls material only; clothing description is secondary to visual evidence; presentation modes focus on scene/presentation; variation prompt requests single-output alternate shots without collages/grids; close-up prompts fall back to supported details rather than inventing construction details.
4. Automated tests at unit and hook-to-request integration boundaries pass across Gemini, Grok, and GPT Image paths.

## Design Notes

- Core prompt builders: `src/utils/virtual-try-on-prompt-builder.ts`, `src/utils/clothing-transfer-prompt-builder.ts`, `src/utils/lookbookPromptBuilder.ts`, `src/components/LookbookGenerator.prompts.ts`.
- Adapter: `src/utils/provider-studio-prompt-adapter.ts` consumes shared prompt builders.
- Hook and driver integration seams: `useVirtualTryOn`, `useClothingTransfer`, `useLookbookGenerator`.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Vitest suites for prompt builders: `virtual-try-on-prompt-builder.test.ts`, `clothing-transfer-prompt-builder.test.ts`, `lookbookPromptBuilder.test.ts`, `provider-studio-prompt-adapter.test.ts` |
| Integration | Hook suites verifying driver request payloads: `useVirtualTryOn.test.tsx`, `useClothingTransfer.test.tsx`, `useLookbookGenerator.test.tsx` |
| E2E | Manual visual acceptance of generated images (CI out of scope per spec) |
| Platform | `npx tsc --noEmit` and `npm run lint` |

## Harness Delta

None.

## Evidence

- Unit tests: `npx vitest run __tests__/utils/virtual-try-on-prompt-builder.test.ts __tests__/utils/lookbookPromptBuilder.test.ts __tests__/utils/clothing-transfer-prompt-builder.test.ts __tests__/utils/provider-studio-prompt-adapter.test.ts` (72 tests passed).
- Hook-to-request integration tests: `npx vitest run __tests__/hooks/useVirtualTryOn.test.tsx __tests__/hooks/useClothingTransfer.test.tsx __tests__/hooks/useLookbookGenerator.test.tsx` (102 tests passed).
- Platform checks: `npx tsc --noEmit` and `npm run build` both succeeded with zero errors.
- Full test suite: `npx vitest run` passed 769 tests across 72 files.
