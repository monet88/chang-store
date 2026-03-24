# Chang-Store — Copilot Workspace Instructions

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with multiple AI backends (Google Gemini, Local Provider, Anti Provider).

## Architecture

```
Component (thin UI) → Hook (state + logic) → Service Facade → Provider API
```

**Provider nesting order** (each depends on parent):

```
LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent
```

**Service routing** — model prefix determines backend (`src/services/imageEditingService.ts`):

| Prefix | Backend | Service file |
|--------|---------|-------------|
| `local--` | Local Provider (REST) | `localProviderService.ts` |
| `anti--` | Anti Provider (REST) | `antiProviderService.ts` |
| _(none)_ | Google Gemini SDK | `gemini/image.ts` |

**Path alias**: `@/*` maps to `src/`.

## Key Patterns

### Every feature = Component + Hook

```typescript
// Component: thin wrapper, NO business logic
const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();
  return <UI state={state} onAction={handlers.action} />;
};

// Hook: state, API calls, gallery integration
export function useFeatureName() {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  const { getModelsForFeature } = useApi();
  return { state: { results, isLoading }, handlers: { handleGenerate } };
}
```

### Adding a new feature

1. Add enum value in `src/types.ts` → `Feature`
2. Create `src/components/FeatureName.tsx` (thin UI)
3. Create `src/hooks/useFeatureName.ts` (all logic)
4. Add case in `src/App.tsx` switch + lazy import
5. Add i18n keys in `src/locales/en.ts` (source of truth), then `src/locales/vi.ts`
6. Add service routing in `src/services/imageEditingService.ts` if new API call needed

### Import order

1. React + external libs
2. Internal contexts/hooks
3. Internal services/utils
4. Types

### Error handling in hooks

```typescript
try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }
```

## Conventions

- **Tailwind only** — no inline styles, no `@apply`
- **Dark glassmorphism** theme — see `docs/design-guidelines.md`
- **i18n**: `const { t } = useLanguage(); t('key.path')` — `locales/en.ts` is source of truth
- **No business logic in components** — extract to hooks
- **No direct API calls from hooks** — go through service facades
- **PascalCase** filenames for components (`.tsx`), camelCase for hooks/services (`.ts`)
- **`React.FC`** type annotation on components
- **Interface over type** for object shapes; avoid `any`

## Directory Guide

| Directory | Role | Details |
|-----------|------|---------|
| `src/components/` | UI layer (~50 components) | See `src/components/AGENTS.md` |
| `src/hooks/` | Feature logic (15 hooks) | See `src/hooks/AGENTS.md` |
| `src/services/` | API facades (stateless, 11 files) | See `src/services/AGENTS.md` |
| `src/contexts/` | Global state (5 contexts) | See `src/contexts/AGENTS.md` |
| `src/utils/` | Pure helpers (15 files) | See `src/utils/AGENTS.md` |
| `src/config/` | Model capability registry | `src/config/modelRegistry.ts` |
| `src/locales/` | i18n (`en.ts`, `vi.ts`) | English is source of truth |
| `__tests__/` | Mirrors source structure | See `__tests__/AGENTS.md` |

## Detailed Docs (link, don't duplicate)

- **Architecture**: `docs/system-architecture.md`
- **Design system**: `docs/design-guidelines.md`
- **Code standards**: `docs/code-standards.md`
- **Codebase summary**: `docs/codebase-summary.md`
- **API docs**: `docs/api/` (Gemini, Imagen, Nano Banana)

## Anti-Patterns

- Never put business logic in components — use hooks
- Never call services directly from components — go through hooks
- Never store API keys in hooks — use `ApiProviderContext`
- Never bypass `imageEditingService.ts` facade for API calls
- Never add inline styles — use Tailwind utilities
- Never create feature components without a corresponding hook
