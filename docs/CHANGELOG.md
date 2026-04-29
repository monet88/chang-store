# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi nhận tại đây.  
Format tuân thủ [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Phiên bản tuân thủ [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] — 2026-04-29

### Removed
- **ImageEditor feature** — toàn bộ component (1229 dòng), 3 sub-components (Canvas, Toolbar, Modal), hook (`useImageEditor`, `useCanvasDrawing`), và state `imageToEdit` từ App
- **OutfitAnalysis feature** — component, hook (`useOutfitAnalysis`), service (`upscaleAnalysisService`), và type `AnalyzedItem`
- **Relight feature** — component và hook (`useRelight`)
- **Upscale feature** — component, hook (`useUpscale`), 12 sub-components trong `src/components/upscale/`, type `UpscaleMode`, `UpscaleStudioStep`
- 4 giá trị Feature enum: `ImageEditor`, `OutfitAnalysis`, `Relight`, `Upscale`
- 322 dòng i18n keys/locale mỗi ngôn ngữ (en, vi)
- Type `RedesignPreset` và `UPSCALE_QUICK_MODELS` (không còn consumer)
- `extractOutfitItem`, `critiqueAndRedesignOutfit` từ `imageEditingService` và `gemini/image`
- `analyzeOutfit`, `parseOutfitAnalysis` từ `textService` và `gemini/text`
- `onEditImage` prop từ `GalleryModal`, `onEdit` button từ `HoverableImage`
- `EditorIcon` import từ HoverableImage

### Fixed
- Session hydration hardened: saved feature ID được validate với `Object.values(Feature).includes()` trước khi restore, fallback về `TryOn` cho retired feature ID

### Changed
- `imageActions.edit` i18n key bị xóa (orphan sau khi xóa onEdit button)

## [Unreleased] — post-v1.5

### Added
- Model registry & capability management system cho Google AI models (`modelRegistry.ts`, `modelSelectionRules.ts`)
- Text generation model selector trên workspace header
- Pattern Generator feature (hook, prompt builder, component, tests)
- Settings modal hook với file validation, async storage, localization
- Hooks cho Photo Album, Virtual Try-On, AI Editor
- UI import boundary enforcement test (`ui-boundary-imports.test.ts`)
- Unit tests cho SettingsModal component và useSettingsModal hook

### Changed
- **Runway UI redesign** — toàn bộ workspace (#23)
- Refactor: tách service flows từ components vào hooks (PoseChanger, BackgroundReplacer, etc.)
- Refactor: isolate UI model boundary — components không import services trực tiếp
- Centralize shared Gemini type contracts
- Centralize `AdjustmentState`, `HSLState`, `GalleryImageFile` to `types.ts` to resolve circular dependencies
- CI logs chỉ hiển thị actionable failures
- Gemini-only architecture reflected trong code và docs
- Rename `.claude/` → `.agents/`

### Fixed
- IndexedDB persistence race condition during initialization (`isHydrated` guard)
- AI editor duplicate generation
- Service boundary review blockers
- Dropdown option text color visibility
- Empty edit results và transfer reuse trong hooks
- Image uploader — toàn bộ hit area có thể click

## [v1.5] — 2026-04-02

### Added
- **Multi-person targeting** cho Virtual Try-On — marker data layer, UI toggle, orchestration engine
- Pattern Generator batch generation guards

### Fixed
- Batch generation full-fanout timing cho clothing transfer và try-on
- Photo album và pose regeneration guards hardened

### Changed
- Performance: wrap `ResultPlaceholder` trong `React.memo`

## [v1.4] — 2026-04-02

### Added
- **Prompt Library** modal với expansion, copy, search, và curated prompts
- Batch download (ZIP) cho Virtual Try-On results
- Parallel batch optimization cho try-on generation

### Changed
- Extract hardcoded concurrency vào named constant (`run-bounded-workers.ts`)
- Performance: `React.memo` cho `HoverableImage`, `GeneratedImage`, `ImageOptionsPanel`

## [v1.3] — 2026-04-01

### Added
- Interleaved `Part[]` prompt builder cho Virtual Try-On (Gemini guard)
- `AGENTS.md` files ở mọi directory level
- Core AI image manipulation features: virtual try-on, upscaling, lookbook, outfit analysis, etc.
- Unlimited references, single-item regenerate, clear all cho batch flows

### Changed
- **Gemini-only architecture** — remove Local/Anti Provider (#10)
- Flat 3-column grid layout cho batch results (try-on, clothing transfer)
- Compact results layout: badge subject, full-width grid, collapsible refine
- Background prompt strengthened từ ambiguous "modify" sang explicit "replace entirely"
- Default aspect ratio → 3:4, default quality → 2K cho tất cả features
- Bump to v1.0.2, add `@types/react`

### Fixed
- Virtual try-on: outfit priority swap, waist-layering cho dual-garment (#5)
- Clothing transfer: upload click, drag-drop flickering (#9), i18n key bugs
- Type annotations cho batch jobs arrays (TS inference)

## [v1.2] — 2026-03-24

### Changed
- **`src/` source root migration** — relocate toàn bộ runtime source tree vào `src/`
- Retarget alias `@/*`, browser entry, build config, test imports
- UAT: 6/6 passed, 0 issues

## [v1.0] — 2026-03-16

### Added
- **AI Studio Upscale** — analysis service, hook integration, UI components, i18n
- Quick Upscale quality lane (model selector, confirmation, glow animation, error suggestion)
- Upscale metadata, smart download, studio preview simulation
- Photo Album feature với frames, backgrounds, poses, hair styles, skin tones
- Lookbook Generator với multiple styles (flat lay, mannequin, hanger, product shot, etc.)
- Virtual Try-On với batch multi-image flows
- Background Replacer với predefined backgrounds
- Pose Changer AI với pose library
- Outfit Analysis & Redesign (casual, smart-casual, luxury, asian-style)
- AI Relighting controls (direction, type, quality)
- Watermark Remover với batch processing
- Clothing Transfer feature
- Image Editor với canvas drawing
- Google Drive sync integration
- Image Gallery với localStorage persistence
- Full i18n support (English, Vietnamese)
- Send-to-feature flow cho image transfer giữa các features
- Comprehensive test suite (18+ tests cho upscale alone)

### Infrastructure
- React 19 + Vite 6 + TypeScript + Tailwind CSS v4
- Vitest + React Testing Library + jsdom
- ESLint 9 với TypeScript/React plugins
- `@google/genai` SDK integration
- GitHub Actions CI pipeline

[Unreleased]: https://github.com/monet88/chang-store/compare/v1.5...HEAD
[v1.5]: https://github.com/monet88/chang-store/compare/v1.4...v1.5
[v1.4]: https://github.com/monet88/chang-store/compare/v1.3...v1.4
[v1.3]: https://github.com/monet88/chang-store/compare/v1.2...v1.3
[v1.2]: https://github.com/monet88/chang-store/compare/v1.0...v1.2
[v1.0]: https://github.com/monet88/chang-store/releases/tag/v1.0
