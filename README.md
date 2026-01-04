# Chang-Store

AI-powered virtual fashion studio built with React + TypeScript (Vite). It combines virtual try-on, lookbook generation, intelligent editing tools, and AI video creation in a single SPA. Now available as a **Windows desktop application** via Tauri!

## Features
- Virtual Try-On: blend a model photo with a garment image
- Lookbook Generator: produce styled sets of outfits
- Background Replacement and Pose Changer: swap scenes and poses while keeping garment details
- Face Swap and Outfit Analysis: transfer faces and get AI descriptions/suggestions
- Relight and Upscale: improve lighting and resolution of assets
- Image Editor and Inpainting: refine outputs with selective edits
- Video Generator, GRWM video, and Video Continuity: turn images into clips and short sequences
- Photo Album Creator and Gallery: save, revisit, and re-edit generated media
- Settings & i18n: sidebar gear opens API key/model settings; language switcher supports EN and VI

## Tech Stack
- React 19 + TypeScript, Vite 6
- **Tauri 2** for desktop app (Windows .exe/.msi)
- Context API for language, API keys, gallery, and viewer state
- Axios for HTTP plus Google Gemini client; optional AIVideoAuto integration for specialized features
- Utility-first styling via className strings (Tailwind-like)

## Prerequisites
- Node.js 18.17+ and npm
- **Rust toolchain** (for desktop build) - install via [rustup.rs](https://rustup.rs/)

## Setup

### Web Development
```bash
npm install
npm run dev  # dev server on http://localhost:3000
```

### Desktop Development (Tauri)
```bash
npm install
npm run tauri:dev  # launches desktop app with hot reload
```

### Environment Variables
Create `.env.local` with:
```
GEMINI_API_KEY=your_key
```
Or paste keys in the Settings modal; they persist in localStorage.

## Scripts

### Web
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR (port 3000) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built app locally |
| `npm run lint` | ESLint across .ts/.tsx |
| `npm run test` | Vitest in run mode |
| `npm run test:ui` | Vitest UI (browser runner) |

### Desktop (Tauri)
| Command | Description |
|---------|-------------|
| `npm run tauri:dev` | Launch desktop app with hot reload |
| `npm run tauri:build` | Build production installers (.exe, .msi) |
| `npm run tauri:icon` | Generate app icons from source image |

## Desktop App Features

When running as a desktop app via Tauri, additional native features are available:

- **File System Access**: Save generated images directly to local folders
- **System Tray**: Minimize to tray, quick access menu
- **Desktop Notifications**: Get notified when generation completes
- **Native Dialogs**: Open/Save file dialogs

### Building Desktop Installers

```bash
npm run tauri:build
```

Output location:
- `src-tauri/target/release/bundle/nsis/` → NSIS installer (.exe)
- `src-tauri/target/release/bundle/msi/` → MSI installer

### Custom App Icon

Replace `src-tauri/app-icon.png` with your 1024x1024 PNG logo, then:
```bash
npm run tauri:icon
```

## Project Structure
- `App.tsx` -> provider stack (LanguageProvider -> ApiProvider -> ImageGalleryProvider -> ImageViewerProvider) and feature switching
- `components/` -> feature UIs (VirtualTryOn, **LookbookGenerator** [orchestrator], **LookbookForm**, **LookbookOutput**, BackgroundReplacer, PoseChanger, SwapFace, PhotoAlbumCreator, OutfitAnalysis, Relight, Upscale, ImageEditor, VideoGenerator, VideoContinuity, GRWMVideoGenerator, Inpainting) plus shared UI (Header, Tabs, GalleryButton/Modal, SettingsModal, modals)
- `contexts/` -> global state for API keys/models, language, gallery, viewer
- `services/` -> AI integrations (gemini, aivideoautoService, imageEditingService, apiClient, **tauriService**)
- `hooks/` -> feature-specific hooks
- `utils/` -> utility functions (**lookbookPromptBuilder.ts** - pure prompt generation, imageUtils.ts, storage.ts)
- `locales/` -> i18n strings (en, vi)
- `types.ts` -> shared enums and types
- `src-tauri/` -> Tauri desktop app (Rust backend, config, icons)
- `vite.config.ts` -> Vite config, @/ alias, env injection, server host/port 3000

## How to use
1) Open the app and click the settings gear to add your keys (Gemini required; others optional)
2) Pick a feature from the left tabs; each tool shows the required inputs (uploads, prompts, poses, aspect ratio)
3) Generated items are saved to the gallery. In desktop mode, you can also save directly to local files.

## Testing & Coverage

```bash
npm run test           # Run all tests
npm run test -- --coverage  # With coverage report
```

Current coverage:
- **407 tests** across 132 test suites
- Contexts: 97.65% | Services: 86.97% | Hooks: 66.66%
- All tests passing with Vitest.

Tests use `setupTests.ts` to register `@testing-library/jest-dom` matchers.

## Documentation

Detailed documentation is available in `docs/`:

| Document | Description |
|----------|-------------|
| [Project Overview & PDR](docs/project-overview-pdr.md) | Vision, target users, feature priorities, requirements |
| [Codebase Summary](docs/codebase-summary.md) | Directory structure, key files, module relationships |
| [Code Standards](docs/code-standards.md) | React/TypeScript conventions, patterns, error handling |
| [System Architecture](docs/system-architecture.md) | Architecture diagrams, data flow, API integrations |

## Known Limitations
- API keys live in the client; avoid production secrets
- Web mode: Generated assets stored in browser localStorage (size-limited)
- Desktop mode: Full file system access available
- No React error boundary; failures surface per feature UI
