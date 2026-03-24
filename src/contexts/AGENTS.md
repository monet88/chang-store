# CONTEXTS - Global State Layer

## OVERVIEW
5 React context providers here + 1 inline context in `components/Toast.tsx`. Each file exports a provider + custom hook.

## WHERE TO LOOK
| Task | Context | Hook | Notes |
|------|---------|------|-------|
| API keys / model selection | `ApiProviderContext.tsx` | `useApi()` | localStorage sync; fallback to `VITE_LOCAL_PROVIDER_*` env vars |
| Image gallery cache | `ImageGalleryContext.tsx` | `useImageGallery()` | In-memory LRU cache + Drive sync queue |
| i18n translation | `LanguageContext.tsx` | `useLanguage()` | `t('key.path')`; default lang `vi` |
| Google Drive auth | `GoogleDriveContext.tsx` | `useGoogleDrive()` | OAuth, token refresh, session persistence |
| Image viewer modal | `ImageViewerContext.tsx` | `useImageViewer()` | Modal state + prev/next navigation |
| Toast notifications | `components/Toast.tsx` | `useToast()` | NOT here — lives in `components/` |

## PROVIDER STACK (App.tsx)
```
LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent
```
> Order matters — each may depend on parent. `ToastProvider` is in `components/Toast.tsx`, not here.

## CONVENTIONS
- localStorage sync happens inside providers (not components or hooks)
- `ApiProviderContext` supports fallback to `VITE_LOCAL_PROVIDER_*` env vars
- Gallery is in-memory only — no localStorage for images
- Drive sync queues operations without blocking UI
- Persistence: localStorage for settings/drafts, Google Drive for images

## ANTI-PATTERNS
- Do not bypass `ApiProviderContext` for keys/models
- Do not persist large binary data in localStorage
- Side-effectful logic belongs in providers, not in consuming components
