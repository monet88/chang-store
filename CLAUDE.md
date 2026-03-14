# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with multiple AI backends (Google Gemini, Local Provider, Anti Provider).

## Providers (Settings)
- Google
- Proxypal Provider (local)
- Anti Provider

## Commands

```bash
# Web Development
npm run dev           # Dev server @ localhost:3000
npm run build         # Production build
npm run lint          # ESLint
npm run test          # Vitest
npm run test -- --coverage  # With coverage
npm run test:ui       # Vitest UI

```

## Issue Tracking

This repository does not currently use a git-tracked issue metadata workflow.

## Architecture

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
| `hooks/` | Feature-specific hooks - all business logic |
| `contexts/` | Global state: API keys, language, gallery, viewer |
| `services/` | API integrations: Gemini, Local, Anti |
| `utils/` | imageUtils.ts, lookbookPromptBuilder.ts |
| `locales/` | i18n: en.ts (source), vi.ts |

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Provider stack + feature router |
| `types.ts` | ImageFile, Feature enum, AspectRatio |
| `services/imageEditingService.ts` | Unified facade - routes by model prefix |
| `services/apiClient.ts` | Gemini client singleton |

## Code Patterns

### Component → Hook separation
```typescript
// Component: thin UI
export const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();
  return <UI state={state} onAction={handlers.action} />;
};

// Hook: all logic
export function useFeatureName() {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  return { state, handlers };
}
```

### Service Routing
```typescript
const model = "local--model-name";     // → Local Provider
const model = "anti--model-name";      // → Anti Provider
const model = "gemini-2.5-flash";      // → Gemini (default)
```

## External APIs

| Service | Auth |
|---------|------|
| Google Gemini (`@google/genai`) | `GEMINI_API_KEY` env or Settings |
| Local Provider | Base URL + API Key in Settings |
| Anti Provider | Base URL + API Key in Settings |

## i18n

- Source: `locales/en.ts` (exports `Translation` type)
- Usage: `const { t } = useLanguage(); t('key.path')`

## Development Notes

- Local storage persistence enabled for settings (API keys, provider config, model selections); gallery remains session-only
- Images stored in-memory via `ImageGalleryContext` (session only)
- Generated images go through `addImage()` from gallery context
