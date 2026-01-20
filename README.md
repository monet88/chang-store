# Chang-Store

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](.)
[![Tests](https://img.shields.io/badge/tests-446%20passing-brightgreen)](.)
[![Coverage](https://img.shields.io/badge/coverage-53%25-yellow)](.)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-2-ffc131)](https://tauri.app/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

AI-powered virtual fashion studio built with React + TypeScript (Vite). It combines virtual try-on, lookbook generation, intelligent editing tools, and AI video creation in a single SPA. Now available as a **Windows desktop application** via Tauri!

---

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd chang-store
npm install

# Web development
npm run dev              # http://localhost:3000

# Desktop development (requires Rust)
npm run tauri:dev        # Launches desktop app with hot reload
```

> **API Keys**: Click the settings gear in the app to add your Gemini API key (required). Other keys are optional.

---

## Features

- **Virtual Try-On**: Blend a model photo with a garment image
- **Lookbook Generator**: Produce styled sets of outfits
- **Background Replacement & Pose Changer**: Swap scenes and poses while keeping garment details
- **Face Swap & Outfit Analysis**: Transfer faces and get AI descriptions/suggestions
- **Relight & Upscale**: Improve lighting and resolution of assets
- **Image Editor & Inpainting**: Refine outputs with selective edits
- **Video Generator, GRWM Video & Video Continuity**: Turn images into clips and short sequences
- **Photo Album Creator & Gallery**: Save, revisit, and re-edit generated media
- **Settings & i18n**: Sidebar gear opens API key/model settings; language switcher supports EN and VI

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, TypeScript 5.8, Vite 6 |
| Desktop | Tauri 2 (Windows .exe/.msi) |
| Styling | Tailwind CSS 4 |
| State | Context API (language, API keys, gallery, viewer) |
| HTTP | Axios, Google Gemini client |
| AI | Google Gemini, AIVideoAuto (optional) |
| Testing | Vitest, React Testing Library |

---

## Prerequisites

- **Node.js** 18.17+ and npm
- **Rust toolchain** (for desktop build) - install via [rustup.rs](https://rustup.rs/)

---

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

```env
GEMINI_API_KEY=your_key
```

Or paste keys in the Settings modal; they persist in localStorage.

---

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

---

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

Output locations:
- `src-tauri/target/release/bundle/nsis/` - NSIS installer (.exe)
- `src-tauri/target/release/bundle/msi/` - MSI installer

### Custom App Icon

Replace `src-tauri/app-icon.png` with your 1024x1024 PNG logo, then:

```bash
npm run tauri:icon
```

---

## Project Structure

```
chang-store/
├── App.tsx              # Provider stack & feature switching
├── components/          # Feature UIs (VirtualTryOn, LookbookGenerator, etc.)
├── contexts/            # Global state (API keys, language, gallery, viewer)
├── services/            # AI integrations (gemini, aivideoauto, tauri)
├── hooks/               # Feature-specific hooks
├── utils/               # Utility functions (prompts, images, storage)
├── locales/             # i18n strings (en, vi)
├── types.ts             # Shared enums and types
├── src-tauri/           # Tauri desktop app (Rust backend, config, icons)
└── vite.config.ts       # Vite config, @/ alias, server settings
```

---

## How to Use

1. Open the app and click the settings gear to add your keys (Gemini required; others optional)
2. Pick a feature from the left tabs; each tool shows the required inputs (uploads, prompts, poses, aspect ratio)
3. Generated items are saved to the gallery. In desktop mode, you can also save directly to local files.

---

## Testing & Coverage

```bash
npm run test                   # Run all tests
npm run test -- --coverage     # With coverage report
```

**Current stats** (as of v1.0.0):

| Metric | Value |
|--------|-------|
| Tests | 446 passing |
| Test Suites | 17 |
| Statements | 53.17% |
| Branches | 51.61% |
| Functions | 49.19% |
| Lines | 53.50% |

**Coverage by module:**

| Module | Coverage |
|--------|----------|
| Contexts | 66.07% |
| Services | 56.30% |
| Hooks | 40.61% |

Tests use `setupTests.ts` to register `@testing-library/jest-dom` matchers.

---

## Documentation

Detailed documentation is available in `docs/`:

| Document | Description |
|----------|-------------|
| [Project Overview & PDR](docs/project-overview-pdr.md) | Vision, target users, feature priorities, requirements |
| [Codebase Summary](docs/codebase-summary.md) | Directory structure, key files, module relationships |
| [Code Standards](docs/code-standards.md) | React/TypeScript conventions, patterns, error handling |
| [System Architecture](docs/system-architecture.md) | Architecture diagrams, data flow, API integrations |

---

## Known Limitations

- API keys live in the client; avoid production secrets
- **Web mode**: Generated assets stored in browser localStorage (size-limited)
- **Desktop mode**: Full file system access available
- No React error boundary; failures surface per feature UI

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

Please ensure your code follows the existing style and includes tests where applicable.

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

---

## Changelog

See [GitHub Releases](../../releases) for version history and release notes.
