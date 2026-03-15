# TESTING

## Test Stack

- Test runner: Vitest 4 (`vitest.config.ts`).
- DOM environment: `jsdom`.
- React test utilities: React Testing Library and `@testing-library/user-event`.
- Matchers: `@testing-library/jest-dom` loaded from `setupTests.ts`.
- Coverage provider: V8.

## Test Discovery

- Included patterns are `**/*.test.ts` and `**/*.test.tsx`.
- Current suites live under `__tests__/`.
- There are 17 current test files under `__tests__/`.

## Coverage Rules

Coverage in `vitest.config.ts` measures:

- `services/**/*.ts`
- `utils/**/*.ts`
- `contexts/**/*.tsx`
- `hooks/**/*.ts`

Global thresholds:

- statements: 80
- branches: 75
- functions: 80
- lines: 80

## Current Test Shape

### Contexts

- `__tests__/contexts/ApiProviderContext.test.tsx`
- `__tests__/contexts/GoogleDriveContext.test.tsx`
- `__tests__/contexts/ImageGalleryContext.test.tsx`
- `__tests__/contexts/ImageViewerContext.test.tsx`
- `__tests__/contexts/LanguageContext.test.tsx`

These verify provider contracts, localStorage behavior, and hook guard errors.

### Hooks

- `__tests__/hooks/useClothingTransfer.test.tsx`
- `__tests__/hooks/useLookbookGenerator.test.tsx`
- `__tests__/hooks/useOutfitAnalysis.test.tsx`
- `__tests__/hooks/useVirtualTryOn.test.tsx`

These focus on state transitions, validation, and async handler behavior.

### Services and Utils

- `__tests__/services/imageEditingService.test.ts`
- `__tests__/services/localProviderService.test.ts`
- `__tests__/services/googleDriveService.test.ts`
- `__tests__/services/gemini/image.test.ts`
- `__tests__/services/gemini/text.test.ts`
- `__tests__/utils/imageCache.test.ts`
- `__tests__/utils/imageUtils.test.ts`

These mostly verify facade routing, provider adaptation, and pure utility behavior.

## Mocking Pattern

- Use `vi.mock(...)` before importing the SUT.
- Shared mocks live in `__tests__/__mocks__/`.
- Provider and external API calls are mocked rather than executed.
- Tests often suppress expected `console.error` noise in setup.

## Practical Guidance for New Tests

- Put new hook tests in `__tests__/hooks/`.
- Put new context tests in `__tests__/contexts/`.
- Put new service or utility tests in `__tests__/services/` or `__tests__/utils/`.
- If you add a new provider path in `services/imageEditingService.ts`, add routing tests first.
- If you add a new translation-driven error path, assert the thrown `error.*` key rather than English text.

## Gaps in Current Coverage

- Feature components themselves have far less direct coverage than hooks, contexts, and services.
- There is no E2E or browser automation suite in the repo.
- Current tests still reference legacy or non-runtime patterns through historical artifacts in the repository, so test scope should be checked against live imports before copying an existing suite.
