# Project Overview

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with multiple AI backends (Google Gemini, Local Provider, Anti Provider). Features include virtual try-on, lookbook generation, background replacement, pose changing, upscaling, image editing, and more.

## Environment Setup

Copy `.env.example` to `.env.local`. Required variables:
- `GEMINI_API_KEY` — Google Gemini API key (for AI features)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (for Drive sync)
- `VITE_LOCAL_PROVIDER_BASE_URL` / `VITE_LOCAL_PROVIDER_API_KEY` — Local Provider endpoint

## Architecture

```
Component (Thin UI) → Hook (State + Logic) → Service Facade → Provider-specific API
```

**Provider hierarchy** (order matters — each depends on parent):
```
LanguageProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent
```

**Service routing** via model prefix in `imageEditingService.ts`:
- `local--model-name` → `localProviderService.ts` (custom REST)
- `anti--model-name` → `antiProviderService.ts` (custom REST)
- No prefix → `gemini/image.ts` (Google Gemini SDK)

## Key Files

| File | Role |
|------|------|
| `App.tsx` | Provider stack, lazy-loaded feature router with CSS display toggling |
| `types.ts` | `Feature` enum, `ImageFile`, `AspectRatio`, resolution/quality types |
| `services/imageEditingService.ts` | Unified facade — routes API calls by model prefix |

## Code Patterns

### Component + Hook (every feature follows this)
```typescript
// Component: thin UI wrapper, no business logic
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

### Feature rendering uses CSS display toggle (not conditional mount) to preserve state:
```tsx
<div style={{ display: activeFeature === Feature.TryOn ? 'block' : 'none' }}>
  <VirtualTryOn />
</div>
```

## Project-Specific Notes

- **Path alias**: `@/*` maps to project root (not `src/`)
- **Design theme**: Dark glassmorphism (see `docs/design-guidelines.md`)
- **i18n**: `locales/en.ts` is source of truth, usage: `const { t } = useLanguage(); t('key.path')`
