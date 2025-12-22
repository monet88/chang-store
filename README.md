# Chang-Store

AI-powered virtual fashion studio built with React + TypeScript (Vite). It combines virtual try-on, lookbook generation, intelligent editing tools, and AI video creation in a single SPA.

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
- Context API for language, API keys, gallery, and viewer state
- Axios for HTTP plus Google Gemini client; optional AIVideoAuto integration for specialized features
- Utility-first styling via className strings (Tailwind-like)

## Prerequisites
- Node.js 18.17+ and npm

## Setup
1) npm install
2) Create .env.local with GEMINI_API_KEY=your_key (exposed as process.env.API_KEY via vite.config.ts)
3) npm run dev (dev server on http://localhost:3000)
   - You can also paste keys in the Settings modal; they persist in localStorage

## Scripts
- npm run dev    # start Vite dev server with HMR (port 3000)
- npm run build  # production build to dist/
- npm run preview # serve the built app locally
- npm run lint   # ESLint across .ts/.tsx
- npm run test   # Vitest in node/watch mode
- npm run test:ui # Vitest UI (browser runner)

## Environment Variables
| Name | Required | Purpose |
| ---- | -------- | ------- |
| GEMINI_API_KEY | Yes | Google Gemini key for image/video generation |

Optional at runtime (entered via Settings UI): AIVideoAuto access token/model metadata.

## Project Structure
- App.tsx -> provider stack (LanguageProvider -> ApiProvider -> ImageGalleryProvider -> ImageViewerProvider) and feature switching
- components/ -> feature UIs (VirtualTryOn, LookbookGenerator, BackgroundReplacer, PoseChanger, SwapFace, PhotoAlbumCreator, OutfitAnalysis, Relight, Upscale, ImageEditor, VideoGenerator, VideoContinuity, GRWMVideoGenerator, Inpainting) plus shared UI (Header, Tabs, GalleryButton/Modal, SettingsModal, modals)
- contexts/ -> global state for API keys/models, language, gallery, viewer
- services/ -> AI integrations (gemini, aivideoautoService, imageEditingService, apiClient)
- hooks/ -> feature-specific hooks
- locales/ -> i18n strings (en, vi)
- text/ -> static copy
- types.ts -> shared enums and types
- vite.config.ts -> Vite config, @/ alias, env injection, server host/port 3000

## How to use
1) Open the app and click the settings gear to add your keys (Gemini required; others optional)
2) Pick a feature from the left tabs; each tool shows the required inputs (uploads, prompts, poses, aspect ratio)
3) Generated items are saved to the gallery (localStorage). Open the gallery to download or send an item into the Image Editor for further tweaks

## Testing & Linting
- Type check via Vite build; automated tests run with `npm run test` (Vitest, jsdom, RTL).
- Lint with `npm run lint`; auto-fix with `npm run lint -- --fix`.
- Tests use `setupTests.ts` to register `@testing-library/jest-dom` matchers.

## Documentation

Detailed documentation is available in `docs/`:

| Document | Description |
|----------|-------------|
| [Project Overview & PDR](docs/project-overview-pdr.md) | Vision, target users, feature priorities, requirements |
| [Codebase Summary](docs/codebase-summary.md) | Directory structure, key files, module relationships |
| [Code Standards](docs/code-standards.md) | React/TypeScript conventions, patterns, error handling |
| [System Architecture](docs/system-architecture.md) | Architecture diagrams, data flow, API integrations |

## Known Limitations
- Automated tests are only scaffolded; feature coverage still needed
- API keys live in the client; avoid production secrets
- Generated assets are stored in browser localStorage, which is size-limited and browser-specific
- No React error boundary; failures surface per feature UI
- Local storage persistence is currently disabled (no-op stubs)
