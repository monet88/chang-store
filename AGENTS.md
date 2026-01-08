# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-08 | **Commit:** b066e51 | **Branch:** main

## OVERVIEW

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with Tauri 2 desktop support. Dual AI backends: Google Gemini, AIVideoAuto.

## STRUCTURE

```
./
├── App.tsx, index.tsx      # Entry points (non-standard: root, not /src/)
├── types.ts                # Shared types: ImageFile, Feature, AspectRatio
├── components/             # 49 UI components (feature + shared + modals)
├── hooks/                  # 15 feature hooks (ALL business logic here)
├── contexts/               # 5 providers: Language, Api, Gallery, Viewer
├── services/               # API facade: Gemini, AIVideoAuto, Tauri
├── utils/                  # imageUtils.ts (active), storage.ts (disabled)
├── locales/                # i18n: en.ts (source), vi.ts
├── src-tauri/              # Rust desktop backend (Tauri 2)
├── docs/                   # Technical documentation
└── plans/                  # Planning + reports
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new feature | `hooks/useFeatureName.ts` → `components/FeatureName.tsx` | Hook-first pattern |
| Fix API issue | `services/imageEditingService.ts` | Routes to Gemini or AIVideoAuto |
| Add translation | `locales/en.ts` (source) → `vi.ts` | Type-safe i18n |
| Desktop functionality | `services/tauriService.ts` → `src-tauri/src/lib.rs` | IPC bridge |
| Global state | `contexts/` | Provider stack order matters |
| Image utilities | `utils/imageUtils.ts` | Conversion, error handling |

## ARCHITECTURE

```
Component (UI) → Hook (Logic) → Service (API Facade) → External APIs
```

**Provider Stack (order matters):**
```
LanguageProvider → ApiProvider → ImageGalleryProvider → ImageViewerProvider → App
```

**Model Routing:**
```typescript
"aivideoauto--*" → AIVideoAuto backend
"gemini-*"       → Gemini backend
```

## CONVENTIONS

| Area | Convention |
|------|------------|
| Imports | `@/` alias → root (non-standard: not /src/) |
| Components | PascalCase, thin UI layer |
| Hooks | `use*` prefix, ALL logic here |
| Services | Facade pattern, singleton clients |
| Tests | `*.test.ts(x)` colocated, Vitest |
| Commits | Conventional: `feat:`, `fix:`, `refactor:` |

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** end session without `git push` (work stranded locally)
- **NEVER** commit `.env` or API keys
- **NEVER** use markdown TODOs - use `bd` (beads) for issues
- **NEVER** put logic in components - extract to hooks
- **DO NOT** use `storage.ts` - persistence disabled
- **Video features** MUST use AIVideoAuto backend
- **Canvas operations** MUST cleanup in useEffect return

## UNIQUE STYLES

- Code at ROOT not `/src/` - `@/*` points to `./`
- Tailwind 4 (not v3)
- Feature switching via switch-case, not router
- Lazy loading via `React.lazy()` for features
- In-memory gallery (session only, no persistence)

## COMMANDS

```bash
npm run dev        # Dev server @ localhost:3000
npm run build      # Production build
npm run test       # Vitest (~400 tests, 97% context coverage)
npm run lint       # ESLint
npm run tauri:dev  # Desktop dev
npm run tauri:build # Desktop release
```

## ISSUE TRACKING (bd)

```bash
bd ready --json              # Unblocked issues
bd create "Title" -p 1 --json # Create issue
bd update bd-42 --status in_progress --json
bd close bd-42 --reason "Done" --json
```

## NOTES

- Large files need refactoring: `ImageEditor.tsx` (1235 lines), `locales/*.ts` (~1000), `services/gemini/video.ts` (759)
- NO CI/CD configured - desktop-focused
- Upscale targets 2K resolution
- Video polling: Gemini (indefinite), AIVideoAuto (10min max)

## SUB-DOCUMENTATION

- `components/AGENTS.md` - UI patterns, modals, shared components
- `services/AGENTS.md` - API facade, Gemini/AIVideoAuto routing
- `src-tauri/AGENTS.md` - Rust backend, IPC commands
