# Project Index: Chang-Store

**Generated:** 2025-12-23
**Type:** AI-powered virtual fashion studio (React SPA)

---

## 📁 Project Structure

```
Chang-Store/
├── App.tsx                  # Main app entry, provider stack
├── index.tsx                # React root
├── types.ts                 # Shared types (Feature, ImageFile, AspectRatio)
├── components/              # UI components (42 files)
│   ├── [Feature]*.tsx       # Feature components (14)
│   └── modals/              # Modal dialogs (5)
├── hooks/                   # Business logic hooks (13 files)
├── contexts/                # Global state providers (4 files)
├── services/                # API integrations
│   ├── gemini/              # Google Gemini (image, text, video)
│   ├── aivideoautoService   # AIVideoAuto API
│   └── imageEditingService  # Unified routing facade
├── locales/                 # i18n (en.ts, vi.ts)
├── utils/                   # Utilities (imageUtils, storage)
├── docs/                    # Technical documentation
└── plans/                   # Implementation plans
```

---

## 🚀 Entry Points

| File | Purpose |
|------|---------|
| `index.tsx` | React DOM root render |
| `App.tsx` | Provider stack + feature router |
| `vite.config.ts` | Vite build config |

---

## 📦 Core Modules

### Components (42 total)

**Feature Components (14):**
- `VirtualTryOn.tsx` - AI try-on feature
- `LookbookGenerator.tsx` - Fashion lookbook
- `BackgroundReplacer.tsx` - Background editing
- `PoseChanger.tsx` - Pose transformation
- `SwapFace.tsx` - Face swap
- `PhotoAlbumCreator.tsx` - Album generation
- `OutfitAnalysis.tsx` - Outfit critique
- `Relight.tsx` - Relighting
- `Upscale.tsx` - Image upscaling
- `ImageEditor.tsx` - General editor
- `VideoGenerator.tsx` - Video gen
- `VideoContinuity.tsx` - Video continuity
- `Inpainting.tsx` - Inpainting
- `GRWMVideoGenerator.tsx` - Get Ready With Me videos

**Shared Components:** Header, ImageUploader, Tabs, Spinner, Tooltip, Icons, etc.

**Modals:** GalleryModal, SettingsModal, PoseLibraryModal, ImageSelectionModal, FeatureSettingsModal

---

### Hooks (13 total)

All hooks follow pattern: `use[Feature]` → returns `{ state, handlers }`

| Hook | Feature |
|------|---------|
| `useVirtualTryOn` | try-on |
| `useLookbookGenerator` | lookbook |
| `useBackgroundReplacer` | background |
| `usePoseChanger` | pose |
| `useSwapFace` | swap-face |
| `usePhotoAlbum` | photo-album |
| `useOutfitAnalysis` | outfit-analysis |
| `useRelight` | relight |
| `useImageEditor` | image-editor |
| `useVideoGenerator` | video |
| `useVideoContinuity` | video-continuity |
| `useInpainting` | inpainting |
| `useGRWMVideoGenerator` | grwm-video |

---

### Contexts (4 providers)

| Context | Purpose |
|---------|---------|
| `LanguageContext` | i18n, `useLanguage()` hook |
| `ApiProviderContext` | API keys, model selection |
| `ImageGalleryContext` | Session image storage |
| `ImageViewerContext` | Image viewing state |

**Provider Stack:**
```
LanguageProvider → ApiProvider → ImageGalleryProvider → ImageViewerProvider
```

---

### Services (7 files)

| Service | Purpose |
|---------|---------|
| `imageEditingService.ts` | **Unified facade** - routes to Gemini or AIVideoAuto |
| `apiClient.ts` | Gemini client singleton |
| `geminiService.ts` | Legacy Gemini wrapper |
| `aivideoautoService.ts` | AIVideoAuto API client |
| `gemini/image.ts` | Gemini image operations |
| `gemini/text.ts` | Gemini text generation |
| `gemini/video.ts` | Gemini video generation |

**Model Routing:**
```typescript
model.startsWith('aivideoauto--') → AIVideoAuto backend
else → Gemini backend
```

---

## 🔧 Configuration

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `vite.config.ts` | Vite dev/build config |
| `tsconfig.json` | TypeScript config |
| `eslint.config.js` | ESLint rules |
| `vitest.config.ts` | Vitest test config |

---

## 📚 Documentation

| File | Topic |
|------|-------|
| `docs/project-overview-pdr.md` | Product requirements |
| `docs/codebase-summary.md` | Structure overview |
| `docs/code-standards.md` | Coding conventions |
| `docs/system-architecture.md` | Architecture diagrams |
| `docs/api/gemini-nanobanana/` | Gemini API reference |

---

## 🔑 Key Types

```typescript
enum Feature {
  TryOn, Lookbook, Background, Pose, SwapFace,
  PhotoAlbum, OutfitAnalysis, Relight, Upscale,
  ImageEditor, Video, VideoContinuity, Inpainting, GRWMVideo
}

interface ImageFile { base64: string; mimeType: string; }
type AspectRatio = 'Default' | '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
type Quality = 'standard' | 'high';
```

---

## 🔗 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.1.1 | UI framework |
| `react-dom` | ^19.1.1 | React DOM |
| `@google/genai` | ^1.17.0 | Gemini AI SDK |
| `axios` | ^1.7.2 | HTTP client |
| `vite` | ^6.2.0 | Build tool |
| `typescript` | ~5.8.2 | Type checking |
| `vitest` | ^4.0.13 | Testing |

---

## 📝 Quick Start

```bash
npm run dev      # Dev server @ localhost:3000
npm run build    # Production build
npm run test     # Run tests
npm run lint     # ESLint check
```

---

## 🎨 Architecture Pattern

```
Component (UI) → Hook (Logic) → Service (API Facade) → External APIs
                                      ↓
                    Gemini API | AIVideoAuto API
```

---

## 📊 File Counts

| Category | Count |
|----------|-------|
| Components | 42 |
| Hooks | 13 |
| Contexts | 4 |
| Services | 7 |
| Locales | 2 |
| Utils | 2 |
| Docs | 9 |

**Total Source Files:** ~79 TypeScript files

---

## 🔒 Notes

- Local storage persistence **disabled** (stubbed in `utils/storage.ts`)
- Images stored in-memory via `ImageGalleryContext` (session only)
- All generated images go through `addImage()` from gallery context
- Upscale targets 2K resolution
- Video generation uses polling (Gemini: indefinite, AIVideoAuto: 10min max)
