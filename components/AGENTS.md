# COMPONENTS - UI Layer

## OVERVIEW
51 React components: 14 AI features + shared UI + modals. Thin wrappers — logic lives in `hooks/`.

## STRUCTURE
```
components/
├── [Feature].tsx (14)     # VirtualTryOn, LookbookGenerator, BackgroundReplacer...
├── shared/                # RefinementInput, ResultPlaceholder
├── modals/                # GalleryModal, SettingsModal, PoseLibraryModal, ImageSelectionModal
├── ImageEditor*.tsx (3)   # Canvas + Toolbar + Modal (orchestrator pattern)
├── Mobile*.tsx (2)        # MobileOverlay, MobileMenuButton
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
| Selectors | `AspectRatioSelector`, `ResolutionSelector`, `QualitySelector` | Composed in `ImageOptionsPanel` |
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

## ANTI-PATTERNS
- **NEVER** put business logic in components — extract to hooks
- **NEVER** call services directly from components — go through hooks
- **DO NOT** use inline styles — use Tailwind
- **DO NOT** create feature components without a corresponding hook

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
