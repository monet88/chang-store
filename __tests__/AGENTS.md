# TESTS - Testing Architecture

## OVERVIEW
~30 test files mirroring source structure. Stack: Vitest + React Testing Library + jsdom.

## STRUCTURE
```
__tests__/
├── utils/
│   ├── imageUtils.test.ts
│   ├── imageCache.test.ts
│   └── virtual-try-on-prompt-builder.test.ts
├── services/
│   ├── apiClient.test.ts
│   ├── imageEditingService.test.ts
│   ├── googleDriveService.test.ts
│   ├── upscaleAnalysisService.test.ts
│   └── gemini/
│       ├── image.test.ts
│       └── text.test.ts
├── hooks/
│   ├── useLookbookGenerator.test.tsx
│   ├── useVirtualTryOn.test.tsx
│   ├── useOutfitAnalysis.test.tsx
│   ├── useClothingTransfer.test.tsx
│   └── useUpscale.test.tsx
├── components/
│   ├── VirtualTryOn.test.tsx
│   ├── ClothingTransfer.test.tsx
│   ├── Upscale.test.tsx
│   └── UpscaleGuidanceCard.test.tsx
├── contexts/
│   ├── ApiProviderContext.test.tsx
│   ├── ImageGalleryContext.test.tsx
│   ├── LanguageContext.test.tsx
│   ├── GoogleDriveContext.test.tsx
│   └── ImageViewerContext.test.tsx
└── __mocks__/
    ├── axios.ts               # Module-level vi.fn() mock
    ├── @google/genai.ts       # Class constructor mock
    └── contexts.tsx           # Shared context mocks (createAllContextMocks)
```

## CONVENTIONS
- Naming: `{filename}.test.ts` / `{filename}.test.tsx`
- Mocks in `__mocks__/` — manual `vi.fn()`
- Import paths: `../../src/hooks/useUpscale` or `@/services/apiClient` (both work)
- `vi.mock()` path must match the import path pattern used in source
- DOM mock classes for `global.Image`, `global.FileReader` — restored in `afterEach`
- Spy pattern: `vi.spyOn(console, 'error').mockImplementation(() => {})`
- Setup file: `setupTests.ts` at root (single import: `@testing-library/jest-dom`)
- Shared context mocks via `createAllContextMocks()` in `__mocks__/contexts.tsx`

## COVERAGE THRESHOLDS (vitest.config.ts)
| Metric | Target | Current |
|--------|--------|---------|
| Statements | 80% | ~53% |
| Branches | 75% | ~52% |
| Functions | 80% | ~49% |
| Lines | 80% | ~54% |

## COMMANDS
```bash
npm run test                           # All tests (run-once)
npm run test -- path/to/file.test.ts  # Single file
npm run test -- --coverage            # With coverage report
npm run test:ui                        # Vitest browser UI
```

## NOTES
- Test images in `images-test/` — used in integration-style service tests
- Coverage currently below targets — adding tests is a priority
