# COMPONENTS - UI Layer

## OVERVIEW

49 React components: 14 features + shared UI + modals. Thin UI layer - logic lives in hooks.

## STRUCTURE

```
components/
├── Feature UIs (14)        # VirtualTryOn, LookbookGenerator, VideoGenerator...
├── shared/                 # Reusable: ResultPlaceholder, Spinner, Tooltip
├── modals/                 # GalleryModal, SettingsModal, PoseLibraryModal
└── ImageEditor*.tsx        # Complex: Canvas, Toolbar, Modal (needs refactor)
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add feature UI | Create `FeatureName.tsx` + import in App.tsx | Pair with hook |
| Image upload | `ImageUploader.tsx`, `MultiImageUploader.tsx` | |
| Gallery display | `modals/GalleryModal.tsx` | Uses ImageGalleryContext |
| Settings | `modals/SettingsModal.tsx` | API keys, preferences |
| Pose selection | `modals/PoseLibraryModal.tsx` | Predefined poses |
| Image editing | `ImageEditor.tsx` + `ImageEditorCanvas.tsx` | 1235 lines - needs split |

## CONVENTIONS

```typescript
// Pattern: thin component, fat hook
export const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();  // ALL logic in hook
  return <UI state={state} onAction={handlers.action} />;
};
```

- PascalCase filenames
- Single export per file
- Props interface above component
- `React.FC` type annotation

## ANTI-PATTERNS

- **NEVER** put business logic in components - use hooks
- **NEVER** call services directly - go through hooks
- **DO NOT** use inline styles - use Tailwind
- **DO NOT** create components without corresponding hook for features

## COMPLEXITY HOTSPOTS

| File | Lines | Issue | Action |
|------|-------|-------|--------|
| `ImageEditor.tsx` | 1235 | SRP violation | Split: Canvas, Toolbar, State |
| `LookbookGenerator.tsx` | ~400 | Multiple concerns | Extract sub-components |

## MODAL PATTERN

```typescript
// Modals receive isOpen + onClose props
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```
