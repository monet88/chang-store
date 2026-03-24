# CONVENTIONS

## Naming

- React components use PascalCase file names such as `src/components/LookbookGenerator.tsx`.
- Context providers also use PascalCase with `Context` in the file name, such as `src/contexts/ApiProviderContext.tsx`.
- Hooks use `use` prefix and camelCase file names, such as `src/hooks/useClothingTransfer.ts`.
- Services use camelCase file names, such as `src/services/imageEditingService.ts`.
- Shared domain types live in `src/types.ts`.

## Preferred Feature Pattern

The cleanest pattern in the repo is:

- Thin component for rendering and prop wiring.
- Hook for state, async logic, and coordination.
- Service facade for provider routing.
- Utility module for heavy prompt-building or pure transforms.

Use `src/components/LookbookGenerator.tsx`, `src/hooks/useLookbookGenerator.ts`, and `src/utils/lookbookPromptBuilder.ts` as the baseline example.

## Component Style

- Components are written as `React.FC`.
- Top-level screens often keep helper callbacks inline with `useCallback`.
- Lazy-loaded screens are declared in `src/App.tsx`.
- Shared output states often use `Spinner`, `ErrorDisplay`, and `ResultPlaceholder`.

## Context Usage

- Context access always goes through exported hooks such as `useApi()` and `useImageGallery()`.
- Context hooks throw if used outside their provider.
- Browser storage reads and writes are contained inside context providers instead of feature components.

## Error Handling

- Async UI flows generally follow `try/catch/finally`.
- User-facing errors should pass through `getErrorMessage(err, t)` from `src/utils/imageUtils.ts`.
- Provider/service code throws translation-key-shaped messages such as `error.api.localProviderFailed`.
- UI layers typically store errors as `string | null`.

## i18n

- UI strings come from `src/locales/en.ts` and `src/locales/vi.ts`.
- Components and hooks read strings with `const { t } = useLanguage()`.
- New user-facing strings should be added to both locale files, not hardcoded in components.

## Provider Configuration Pattern

- Hooks and components build small config objects and pass them to `src/services/imageEditingService.ts`.
- Model selection should come from `useApi().getModelsForFeature(feature)`, not direct hardcoding.
- Provider prefix checks (`local--`, `anti--`) belong in service/facade code, not UI code.

## Testing Style

- Tests use Vitest with `vi.mock` declared before importing the subject under test.
- Service tests assert routing behavior and parameter passing.
- Context tests use hook render helpers and provider wrappers.
- Shared mocks live in `__tests__/__mocks__/`.

## What To Copy vs What To Avoid

Copy:

- `src/components/LookbookGenerator.tsx`
- `src/hooks/useLookbookGenerator.ts`
- `src/hooks/useClothingTransfer.ts`
- `src/contexts/ApiProviderContext.tsx`

Avoid for new work:

- Adding more feature logic directly into large view components like `src/components/VirtualTryOn.tsx`.
- Duplicating provider-routing logic outside `src/services/imageEditingService.ts`.
- Treating `repomix-output.xml` or root docs as canonical code conventions.
