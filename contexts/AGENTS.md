# CONTEXTS KNOWLEDGE BASE

## OVERVIEW
Contexts manage app-wide state like API keys, language, gallery cache, and viewer state.

## STRUCTURE
```
contexts/
├── ApiProviderContext.tsx
├── ImageGalleryContext.tsx
├── LanguageContext.tsx
├── GoogleDriveContext.tsx
└── ImageViewerContext.tsx
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|------|
| API keys/models | `contexts/ApiProviderContext.tsx` | LocalStorage sync + model routing |
| Gallery cache | `contexts/ImageGalleryContext.tsx` | LRU cache + Drive sync |
| i18n | `contexts/LanguageContext.tsx` | `t()` translator + interpolation |
| Drive auth | `contexts/GoogleDriveContext.tsx` | Drive connection state |
| Viewer state | `contexts/ImageViewerContext.tsx` | Modal/viewer state |

## CONVENTIONS
- Each context exports provider + hook (e.g., `useLanguage`).
- LocalStorage sync happens inside contexts, not components.
- Default language is `vi` with key-path translation lookup.

## ANTI-PATTERNS
- Do not bypass `ApiProviderContext` for keys/models.
- Avoid side-effectful logic in components; keep it in providers.
- Do not persist large binary data in localStorage.

## NOTES
- Gallery remains in-memory; Drive sync queues uploads/deletes.
