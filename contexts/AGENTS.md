# CONTEXTS - Global State Layer

## OVERVIEW
5 React contexts in this directory + 1 inline context in `components/Toast.tsx`. Each exports a provider + custom hook.

## WHERE TO LOOK
| Task | Context | Hook | Notes |
|------|---------|------|-------|
| API keys/models | `ApiProviderContext.tsx` | `useApi()` | localStorage sync, model routing |
| Gallery cache | `ImageGalleryContext.tsx` | `useImageGallery()` | In-memory LRU cache + Drive sync |
| i18n | `LanguageContext.tsx` | `useLanguage()` | `t('key.path')` translator, default `vi` |
| Drive auth | `GoogleDriveContext.tsx` | `useGoogleDrive()` | OAuth, token refresh, session persistence |
| Image viewer | `ImageViewerContext.tsx` | `useImageViewer()` | Modal state + navigation |
| Toast notifications | `components/Toast.tsx` | `useToast()` | NOT in this dir — lives in components/ |

## PROVIDER STACK (App.tsx)
```
LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent
```

> **Note**: `ToastProvider` is in `components/Toast.tsx`, not in `contexts/`. All others are in this directory.

## CONVENTIONS
- localStorage sync happens inside contexts (not components)
- `ApiProviderContext` supports fallback to `VITE_LOCAL_PROVIDER_*` env vars
- Gallery is in-memory only (no localStorage persistence for images)
- Drive sync queues uploads/deletes without blocking UI
- Persistence: localStorage for settings/drafts, Google Drive for images

## ANTI-PATTERNS
- Do not bypass `ApiProviderContext` for keys/models
- Do not persist large binary data in localStorage
- Side-effectful logic belongs in providers, not components
