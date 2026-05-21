# Code Standards & Guidelines

## Architecture Rules
1. **Layered Architecture**: `Component (Thin UI) → Hook (Logic/State) → Service Facade → Gemini API`.
2. **Components**: Must be thin UI wrappers with zero business logic. Never put business logic in components. Never call services directly from components; go through hooks.
3. **Hooks**: All state, validation, API calls, and gallery integration belong in paired hooks.
4. **Service Boundary**: Service routing stays centralized in `src/services/imageEditingService.ts` and fans into Gemini service modules under `src/services/gemini/`. Never bypass `imageEditingService.ts` for API calls.
5. **No React Router**: `App.tsx` switches on `Feature` enum with lazy-loading.
6. **Path Aliasing**: `@/*` maps to `src/`.

## Coding Practices
1. **TypeScript**: Do not suppress type errors with `@ts-ignore` or `any` unless absolutely necessary.
2. **Error Handling**: Use the mandatory async hook error pattern:
   ```typescript
   try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }
   ```
3. **API Keys**: API keys must come from `ApiProviderContext`, never from hook state.
4. **Styling**: Tailwind CSS only — no inline styles, no `@apply`. Follow the existing Runway-inspired patterns.
5. **Localization (i18n)**: Manage strings via `src/locales/en.ts`. Usage pattern: `const { t } = useLanguage(); t('key.path')`.
6. **File Modification**: Edit existing files in place. Never create duplicate variations like `FeatureV2.tsx` or `Utils_new.ts`.

## Testing
- After substantive changes, run `npx tsc --noEmit` and `npm run lint`.
- Use Vitest and React Testing Library for component testing.
- UI service-import boundary tests are located in `__tests__/components/ui-boundary-imports.test.ts`.

## Contexts & Providers
Provider nesting order matters and each depends on the parent:
`LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent`
(Note: `ToastProvider` lives in `src/components/Toast.tsx`, not in `contexts/`)

## File Organization
- **Components:** One component per file, thin UI wrappers only
- **Hooks:** One hook per feature, centralizes all state and logic
- **Services:** Stateless API facades, organized by domain (Gemini modules in `src/services/gemini/`)
- **Utils:** Pure functions, prompt builders, helpers organized by concern
- **Contexts:** Global state providers with strict nesting order
- **Locales:** i18n strings organized by feature/domain

## Prompt Builder Pattern
Feature-specific prompt builders in `src/utils/` construct AI prompts:
- Each builder exports a function that takes feature parameters and returns a prompt string
- Builders enforce domain-specific constraints (e.g., clothing transfer enforces source-destination separation)
- Builders are pure functions with no side effects

## Batch Processing Pattern
- `batch-image-session.ts` manages multi-image sessions
- `run-bounded-workers.ts` provides a bounded worker pool for parallel processing
- Features like watermark removal and clothing transfer support batch operations
- Batch operations respect API rate limits and memory constraints

## Data Persistence
- **IndexedDB:** Gallery images persisted via `idb-keyval` wrapper in `src/utils/galleryDB.ts`
- **Google Drive:** Cloud archiving via `src/services/googleDriveService.ts` (411 LOC)
- **Local Storage:** Settings and user preferences via `src/utils/storage.ts`

## Model Registry
- `src/config/modelRegistry.ts` (218 LOC) maintains feature-to-model mapping
- Centralized capability registry enables feature routing and fallback selection
- Never hardcode model names in components or hooks; use the registry
