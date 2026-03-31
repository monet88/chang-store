# CLAUDE.md

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA. Three AI backends: Google Gemini SDK, Local Provider REST, Anti Provider REST.

## Project map

| Directory | Role |
|-----------|------|
| `src/components/` | UI layer — thin wrappers (~50 files, incl. `upscale/`, `modals/`) |
| `src/hooks/` | Feature logic + state (one hook per feature) |
| `src/services/` | API facades (stateless), incl. `gemini/` |
| `src/contexts/` | Global state providers |
| `src/utils/` | Pure helpers, prompt builders (`*-prompt-builder.ts`) |
| `src/config/` | Model capability registry (`modelRegistry.ts`) |
| `src/locales/` | i18n: `en.ts` (source of truth) + `vi.ts` |
| `__tests__/` | Mirrors `src/` |
| `docs/` | Architecture, design guidelines, code standards, API refs |

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add a feature | `src/types.ts` → `src/components/` → `src/hooks/` → `src/App.tsx` → `src/locales/en.ts` |
| Service routing | `src/services/imageEditingService.ts` (unified facade) |
| Global state | `src/contexts/` (see `src/contexts/AGENTS.md`) |
| i18n strings | `src/locales/en.ts` |
| Model registry | `src/config/modelRegistry.ts` |
| Image processing | `src/utils/imageUtils.ts` |

## Architecture

`Component (thin UI) → Hook (state + logic) → Service Facade → Provider API`

No React Router — `App.tsx` switches on `Feature` enum with lazy-loading. Path alias: `@/*` → `src/`.

Feature enum (`src/types.ts`): `TryOn | Lookbook | Background | Pose | PhotoAlbum | OutfitAnalysis | Relight | Upscale | ImageEditor | AIEditor | WatermarkRemover | ClothingTransfer`

<important if="you need to run commands to build, test, lint, or type-check">

| Command | What it does |
|---------|-------------|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Production build |
| `npm run test` | Vitest run-once |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |

After any substantive code changes, run `npx tsc --noEmit` and `npm run lint` to verify no errors. Do not suppress type errors with `@ts-ignore` or `any` unless absolutely necessary.
</important>

<important if="you are adding a new feature to the application">

5-step checklist:
1. `src/types.ts` → add `Feature.XxxYyy`
2. `src/components/XxxYyy.tsx` — thin UI (see any existing feature component for pattern)
3. `src/hooks/useXxxYyy.ts` — all logic (see any existing feature hook for pattern)
4. `src/App.tsx` — lazy import + switch case
5. `src/locales/en.ts` → add keys; `vi.ts` → add translations
</important>

<important if="you are modifying service routing, API calls, or provider integration">

Service routing via model name prefix in `src/services/imageEditingService.ts`:

| Prefix | Backend | File |
|--------|---------|------|
| `local--` | Local Provider REST | `localProviderService.ts` |
| `anti--` | Anti Provider REST | `antiProviderService.ts` |
| _(none)_ | Google Gemini SDK | `gemini/image.ts` |

Never bypass `imageEditingService.ts` for API calls. API keys must come from `ApiProviderContext`, never hook state.
</important>

<important if="you are modifying providers, context, or global state">

Provider nesting order matters (each depends on parent):
`LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent`

`ToastProvider` lives in `src/components/Toast.tsx`, NOT in `contexts/`.
</important>

<important if="you are writing or modifying components or hooks">

Components must be thin UI wrappers with zero business logic. All state, API calls, and gallery integration go in the paired hook. See any existing component/hook pair for the pattern.

Never put business logic in components. Never call services directly from components — go through hooks. Every feature component must have a paired hook.

Mandatory error handling: `try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }`
</important>

<important if="you are adding or modifying i18n strings or translations">

Source of truth: `src/locales/en.ts`. `vi.ts` mirrors it.
Usage: `const { t } = useLanguage(); t('key.path')`
</important>

<important if="you are writing styles or modifying UI appearance">

Tailwind only — no inline styles, no `@apply`. Dark glassmorphism theme per `docs/design-guidelines.md`.
</important>

<important if="you are refactoring or touching components that import services directly">

Known tech debt — these components import services directly (should go through hooks):
`AIEditor`, `ImageEditor`, `LookbookOutput`, `SettingsModal`, `Relight`, `PoseChanger`, `PhotoAlbumCreator`, `OutfitAnalysis`, `shared/RefinementInput`
</important>

<important if="you are about to delete files, run destructive git commands, or perform irreversible operations">

- Never delete files without explicit user permission — even files you created.
- Never run `git reset --hard`, `git clean -fd`, `rm -rf` without the user providing the exact command.
- Default branch is `main`. Never use `master`.
</important>

<important if="you are creating or modifying files">

Edit existing files in place. Never create variations like `FeatureV2.tsx` or `Utils_new.ts`. Never use script-based bulk search & replace (e.g. `sed`) on code files.
</important>

<important if="you are ending a work session or the user says they are done">

1. File issues/todos for remaining work
2. Run quality gates if code changed: `npx tsc --noEmit`, `npm run lint`, `npm run test`
3. Commit work if applicable
4. Save context summary for the next session
</important>

<important if="you need to use gstack skills for browsing, QA, review, or deployment">

Use `/gstack-browse` for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
If gstack skills aren't working: `cd .claude/skills/gstack && ./setup --prefix`
</important>

<important if="you are using a third-party library you are not fully confident about">

Search online for latest documentation via Context7 MCP or web search. Do not hallucinate APIs.
</important>
