# COMPONENTS - UI Layer

## OVERVIEW
~50 React components: 12 AI feature components + shared UI + modals + upscale sub-components. Thin wrappers — all logic in `hooks/`.

## STRUCTURE
```
components/
├── [Feature].tsx (12)     # VirtualTryOn, LookbookGenerator, BackgroundReplacer, ClothingTransfer...
├── shared/                # RefinementInput, ResultPlaceholder, ImageBatchSessionRail
├── modals/                # GalleryModal, SettingsModal, PoseLibraryModal, ImageSelectionModal → see AGENTS.md
├── upscale/               # 11 step-based sub-components → see upscale/AGENTS.md
├── ImageEditor*.tsx (3)   # Canvas + Toolbar + Modal (orchestrator pattern, ~1235 lines)
├── Mobile*.tsx (2)        # MobileOverlay, MobileMenuButton
├── Toast.tsx              # ToastProvider + useToast — inline context, NOT in contexts/
├── LookbookGenerator.prompts.ts  # Prompt string constants (co-located with component)
└── predefinedContent.ts          # Static data: predefined backgrounds/poses
```

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| Add feature UI | `FeatureName.tsx` + lazy import in `App.tsx` | Must pair with hook |
| Image upload | `ImageUploader.tsx`, `MultiImageUploader.tsx` | Shared uploaders |
| Gallery display | `modals/GalleryModal.tsx` | Uses `useImageGallery()` |
| Settings/API keys | `modals/SettingsModal.tsx` | Model selection, API key config |
| Image editing | `ImageEditor.tsx` → `ImageEditorCanvas.tsx` | Orchestrator → canvas |
| Upscale UI | `upscale/*.tsx` | Step-based studio + quick panels |
| Batch session rail | `shared/ImageBatchSessionRail.tsx` | Shared across batch features |
| Selectors | `AspectRatioSelector`, `ResolutionSelector`, `QualitySelector` | Composed in `ImageOptionsPanel` |
| Toast notifications | `Toast.tsx` | ToastProvider + useToast hook here |
| Icons | `Icons.tsx` | 40+ SVG icon components |

## CONVENTIONS
```typescript
export const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();  // ALL logic in hook
  return <UI state={state} onAction={handlers.action} />;
};
```
- PascalCase `.tsx` filenames; `.ts` for pure logic files
- `React.FC` type annotation on all components
- Props interface defined above component
- Tailwind only — no inline styles, no `@apply`
- CSS `display` toggling (block/none) to preserve state across tab switches

## ANTI-PATTERNS
- **NEVER** put business logic in components — extract to hook
- **NEVER** call services directly from components — go through hooks
- **DO NOT** create feature component without a corresponding hook

## KNOWN VIOLATIONS (tech debt)
These import services directly — should route through hooks:
`AIEditor`, `ImageEditor`, `LookbookOutput`, `SettingsModal`, `Relight`, `PoseChanger`, `PhotoAlbumCreator`, `OutfitAnalysis`, `shared/RefinementInput`

## COMPLEXITY HOTSPOTS
| File | Lines | Note |
|------|-------|------|
| `ImageEditor.tsx` | ~1235 | Orchestrator; Canvas/Toolbar already extracted |
| `Icons.tsx` | ~400 | Acceptable — single SVG library |
