# Codebase Summary

## Statistics
- **Total Files (excluding tests and external modules):** ~147 files
- **Total Lines of Code:** ~38,688 LOC

### Breakdown
- `src/`: 116 files, ~20,838 LOC
  - `components/`: 53 files, ~8,064 LOC
  - `hooks/`: 17 files, ~4,057 LOC
  - `services/`: 12 files, ~2,488 LOC
  - `utils/`: 15 files, ~1,727 LOC
  - `locales/`: 3 files, ~2,073 LOC
  - `contexts/`: 6 files, ~955 LOC
  - `config/`: 3 files, ~310 LOC
  - `data/`: 1 file, ~217 LOC
- `docs/`: 9 files, ~8,015 LOC (includes API refs)

## Key Directories
- **`src/components/`**: UI layer consisting of thin wrappers, feature screens, shared UI, and modals.
- **`src/hooks/`**: Feature logic and state management. One hook per feature where possible.
- **`src/services/`**: API facades (stateless), including provider-specific Gemini modules (`gemini/`).
- **`src/contexts/`**: Global state providers (e.g., LanguageProvider, ApiProvider, GoogleDriveProvider).
- **`src/utils/`**: Pure helpers, prompt builders (`*-prompt-builder.ts`), image processing, and ZIP/download helpers.
- **`src/config/`**: Model capability registry (`modelRegistry.ts`) and model selection rules.
- **`src/locales/`**: i18n dictionaries (`en.ts` as source of truth, `vi.ts` as mirror).
- **`__tests__/`**: Vitest and React Testing Library suites mirroring the source structure.

## Code Intelligence
The project uses GitNexus for code intelligence:
- **Indexed items**: ~2805 symbols, ~4656 relationships, ~194 execution flows.
