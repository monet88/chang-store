# CLAUDE.md - Chang-Store Project Guide

## Project Overview

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with dual AI backends (Google Gemini, AIVideoAuto).

## Quick Reference

```bash
npm run dev      # Dev server @ localhost:3000
npm run build    # Production build
npm run test     # Vitest
npm run lint     # ESLint
```

## Architecture Pattern

```
Component (UI) → Hook (Logic) → Service (API Facade) → External APIs
```

**Provider Stack:**
```
LanguageProvider → ApiProvider → ImageGalleryProvider → ImageViewerProvider → App
```

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `components/` | Feature UIs (14) + Shared (10) + Modals (5) |
| `hooks/` | Feature-specific hooks (13) - all business logic here |
| `contexts/` | Global state: API keys, language, gallery, viewer |
| `services/` | API integrations: Gemini, AIVideoAuto |
| `services/gemini/` | image.ts, text.ts, video.ts |
| `utils/` | imageUtils.ts (active), storage.ts (disabled) |
| `locales/` | i18n: en.ts (source), vi.ts |
| `docs/` | Technical documentation |

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Provider stack + feature router |
| `types.ts` | Shared types: ImageFile, Feature enum, AspectRatio |
| `services/imageEditingService.ts` | Unified facade - routes to Gemini or AIVideoAuto |
| `services/apiClient.ts` | Gemini client singleton |

## Code Conventions

### Component Pattern
```typescript
// Feature component - thin UI layer
export const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();
  return <UI state={state} onAction={handlers.action} />;
};
```

### Hook Pattern
```typescript
// Feature hook - all logic here
export function useFeatureName() {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  const { getModelsForFeature } = useApi();

  // State, handlers, effects
  return { state, handlers };
}
```

### Service Routing
```typescript
// Model prefix determines backend
const model = "aivideoauto--model-name";  // → AIVideoAuto
const model = "gemini-2.5-flash";          // → Gemini
```

## External APIs

| Service | SDK/URL | Auth |
|---------|---------|------|
| Google Gemini | `@google/genai` | `GEMINI_API_KEY` env or Settings |
| AIVideoAuto | `api.gommo.net/ai` | access_token in Settings |

## Features (14)

`try-on` `lookbook` `background` `pose` `swap-face` `photo-album` `outfit-analysis` `relight` `upscale` `image-editor` `video` `video-continuity` `inpainting` `grwm-video`

## i18n

- Source: `locales/en.ts` (exports `Translation` type)
- Vietnamese: `locales/vi.ts` (implements `Translation`)
- Usage: `const { t } = useLanguage(); t('key.path')`

## Error Handling

```typescript
import { getErrorMessage } from '@/utils/imageUtils';
catch (err) {
  setError(getErrorMessage(err, t));
}
```

## Types

```typescript
interface ImageFile { base64: string; mimeType: string; }
type AspectRatio = 'Default' | '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
enum Feature { TryOn = 'try-on', Lookbook = 'lookbook', ... }
```

## Development Notes

- Local storage persistence is **disabled** (stubbed in `utils/storage.ts`)
- Images stored in-memory via `ImageGalleryContext` (session only)
- All generated images go through `addImage()` from gallery context
- Upscale targets 2K resolution
- Video generation uses polling pattern (Gemini: indefinite, AIVideoAuto: 10min max)

## Documentation

See `docs/` for detailed documentation:
- `project-overview-pdr.md` - Vision, requirements
- `codebase-summary.md` - Structure, modules
- `code-standards.md` - Conventions, patterns
- `system-architecture.md` - Architecture diagrams
