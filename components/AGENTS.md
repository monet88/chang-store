# COMPONENTS - UI Layer

## OVERVIEW
~50 React components: 14 AI features + shared UI + modals + upscale sub-components. Thin wrappers — logic lives in `hooks/`.

## STRUCTURE
```
components/
├── [Feature].tsx (14)     # VirtualTryOn, LookbookGenerator, BackgroundReplacer, ClothingTransfer...
├── shared/                # RefinementInput, ResultPlaceholder, ImageBatchSessionRail
├── modals/                # GalleryModal, SettingsModal, PoseLibraryModal, ImageSelectionModal
├── upscale/               # 11 sub-components for Upscale feature (studio + quick modes)
├── ImageEditor*.tsx (3)   # Canvas + Toolbar + Modal (orchestrator pattern)
├── Mobile*.tsx (2)        # MobileOverlay, MobileMenuButton
├── Toast.tsx              # ToastProvider + useToast (inline context, NOT in contexts/)
├── LookbookGenerator.prompts.ts  # Prompt constants
└── predefinedContent.ts          # Predefined backgrounds/poses
```

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| Add feature UI | Create `FeatureName.tsx` + lazy import in `App.tsx` | Pair with hook |
| Image upload | `ImageUploader.tsx`, `MultiImageUploader.tsx` | Shared uploaders |
| Gallery display | `modals/GalleryModal.tsx` | Uses ImageGalleryContext |
| Settings | `modals/SettingsModal.tsx` | API keys, model selection |
| Image editing | `ImageEditor.tsx` → `ImageEditorCanvas.tsx` | Complex orchestrator |
| Upscale UI | `upscale/*.tsx` | 11 step-based sub-components |
| Batch session rail | `shared/ImageBatchSessionRail.tsx` | Shared batch processing UI |
| Selectors | `AspectRatioSelector`, `ResolutionSelector`, `QualitySelector` | Composed in `ImageOptionsPanel` |
| Toast notifications | `Toast.tsx` | Contains ToastProvider + useToast |
| Icons | `Icons.tsx` | 40+ SVG icon components |

## CONVENTIONS
```typescript
// Pattern: thin component, fat hook
export const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();  // ALL logic in hook
  return <UI state={state} onAction={handlers.action} />;
};
```

- PascalCase filenames (`.tsx` for JSX, `.ts` for pure logic)
- Single default export per feature component
- Props interface above component definition
- `React.FC` type annotation
- Tailwind utility classes only (no inline styles, no `@apply`)
- Conditional rendering via CSS `display` toggling (block/none) to preserve state

## ANTI-PATTERNS
- **NEVER** put business logic in components — extract to hooks
- **NEVER** call services directly from components — go through hooks
- **DO NOT** use inline styles — use Tailwind
- **DO NOT** create feature components without a corresponding hook

## KNOWN VIOLATIONS
These components import services directly (tech debt — should go through hooks):
`AIEditor`, `ImageEditor`, `LookbookOutput`, `SettingsModal`, `Relight`, `PoseChanger`, `PhotoAlbumCreator`, `OutfitAnalysis`, `shared/RefinementInput`

## MODAL PATTERN
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}
// All modals lazy-loaded via React.lazy in App.tsx
```

## COMPLEXITY HOTSPOTS
| File | Lines | Issue | Action |
|------|-------|-------|--------|
| `ImageEditor.tsx` | ~1235 | SRP violation | Canvas/Toolbar already split but orchestrator large |
| `Icons.tsx` | ~400 | Icon library | Acceptable — single source for all icons |
