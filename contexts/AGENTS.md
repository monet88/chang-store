# CONTEXTS - Global State Layer

## OVERVIEW
5 React contexts managing app-wide state. Each exports a provider + custom hook.

## WHERE TO LOOK
| Task | Context | Hook | Notes |
|------|---------|------|-------|
| API keys/models | `ApiProviderContext.tsx` | `useApi()` | localStorage sync, model routing |
| Gallery cache | `ImageGalleryContext.tsx` | `useImageGallery()` | In-memory LRU cache + Drive sync |
| i18n | `LanguageContext.tsx` | `useLanguage()` | `t('key.path')` translator, default `vi` |
| Drive auth | `GoogleDriveContext.tsx` | `useGoogleDrive()` | OAuth, token refresh, session persistence |
| Image viewer | `ImageViewerContext.tsx` | `useImageViewer()` | Modal state + navigation |

## PROVIDER STACK (App.tsx)
```
LanguageProvider → ApiProvider → ImageGalleryProvider → ImageViewerProvider → App
```

## CONVENTIONS
- localStorage sync happens inside contexts (not components)
- `ApiProviderContext` supports fallback to `VITE_LOCAL_PROVIDER_*` env vars
- Gallery is in-memory only (no localStorage persistence for images)
- Drive sync queues uploads/deletes without blocking UI

## ANTI-PATTERNS
- Do not bypass `ApiProviderContext` for keys/models
- Do not persist large binary data in localStorage
- Side-effectful logic belongs in providers, not components
