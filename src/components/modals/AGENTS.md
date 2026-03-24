# MODALS - Dialog Layer

## OVERVIEW
4 modal dialogs, all lazy-loaded via `React.lazy` in `App.tsx`. Controlled by `isOpen`/`onClose` props from `AppContent`.

## FILES
| File | Purpose |
|------|---------|
| `GalleryModal.tsx` | Full image gallery with Drive sync indicator |
| `SettingsModal.tsx` | API keys + model selection per feature |
| `PoseLibraryModal.tsx` | Browse and select reference poses |
| `ImageSelectionModal.tsx` | Pick images from gallery for features |

## CONVENTIONS
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  // feature-specific props
}
```
- All modals receive `isOpen` + `onClose` as minimum props
- Heavy context consumption is OK here (GalleryModal uses `useImageGallery`)
- `SettingsModal` is a known tech debt violator — imports services directly

## ANTI-PATTERNS
- Do not add business logic — modals are display + user input only
- Do not fetch data in modals — receive via props or context
