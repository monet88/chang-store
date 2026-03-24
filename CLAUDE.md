# Chang-Store — Agent Knowledge Base

**Generated:** 2026-03-24 | **Commit:** 8b3ac60 | **Branch:** main

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA. Three AI backends: Google Gemini SDK, Local Provider REST, Anti Provider REST.

## Architecture

```
Component (thin UI) → Hook (state + logic) → Service Facade → Provider API
```

**Provider stack** (nesting order matters — each depends on parent):
```
LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent
```
> `ToastProvider` lives in `src/components/Toast.tsx` — NOT in `contexts/`.

**Service routing** via model name prefix (`src/services/imageEditingService.ts`):

| Prefix | Backend | File |
|--------|---------|------|
| `local--` | Local Provider REST | `localProviderService.ts` |
| `anti--` | Anti Provider REST | `antiProviderService.ts` |
| _(none)_ | Google Gemini SDK | `gemini/image.ts` |

**Path alias**: `@/*` → `src/`. **Feature routing**: no React Router — `App.tsx` switches on `Feature` enum, lazy-loading components.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a feature | `src/types.ts` + `src/components/` + `src/hooks/` + `src/App.tsx` + `src/locales/en.ts` | 5-step checklist below |
| Service routing | `src/services/imageEditingService.ts` | Unified facade |
| Global state | `src/contexts/` | See `src/contexts/AGENTS.md` |
| i18n strings | `src/locales/en.ts` | Source of truth; `vi.ts` mirrors it |
| Model registry | `src/config/modelRegistry.ts` | Feature→model capability map |
| Image processing | `src/utils/imageUtils.ts` | compress, crop, base64, errors |
| Prompt builders | `src/utils/*-prompt-builder.ts` | Pure functions |
| Tests | `__tests__/` | See `__tests__/AGENTS.md` |
| Docs | `docs/` | architecture, design, code-standards, api/ |

## Project Structure

| Directory | Files | Role | AGENTS.md |
|-----------|-------|------|-----------|
| `src/components/` | ~50 | UI layer — thin wrappers | ✅ |
| `src/components/upscale/` | 11 | Upscale step-based sub-UI | ✅ |
| `src/components/modals/` | 4 | Modal dialogs | ✅ |
| `src/hooks/` | 15 | Feature logic + state | ✅ |
| `src/services/` | 10 + gemini/ | API facades (stateless) | ✅ |
| `src/contexts/` | 5 | Global state providers | ✅ |
| `src/utils/` | 15 | Pure helpers | ✅ |
| `src/config/` | 1 | Model capability registry | — |
| `src/locales/` | 2 | i18n en.ts + vi.ts | — |
| `__tests__/` | ~30 | Mirrors src/ | ✅ |

## Feature Enum (`src/types.ts`)

```
TryOn | Lookbook | Background | Pose | PhotoAlbum | OutfitAnalysis
Relight | Upscale | ImageEditor | AIEditor | WatermarkRemover | ClothingTransfer
```

## Key Patterns

**Component**: thin wrapper, zero business logic.
```typescript
export const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();
  return <UI state={state} onAction={handlers.action} />;
};
```

**Hook**: all state, API calls, gallery integration.
```typescript
export function useFeatureName() {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  const { getModelsForFeature } = useApi();
  // ...
  return { state, handlers };
}
```

**Error handling** (mandatory pattern):
```typescript
try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }
```

**Adding a new feature** (5 steps):
1. `src/types.ts` → add `Feature.XxxYyy`
2. `src/components/XxxYyy.tsx` — thin UI
3. `src/hooks/useXxxYyy.ts` — all logic
4. `src/App.tsx` — lazy import + switch case
5. `src/locales/en.ts` → keys; `vi.ts` → translations

**Import order**: React/external → contexts/hooks → services/utils → types.

## Conventions

- **Tailwind only** — no inline styles, no `@apply`
- **Dark glassmorphism** theme — `docs/design-guidelines.md`
- **i18n**: `const { t } = useLanguage(); t('key.path')`
- **PascalCase** for `.tsx` filenames; **camelCase** for `.ts`
- **`React.FC`** type on all components
- **Interface** over type for object shapes; avoid `any`
- **Build**: vendor chunks (vendor-react, vendor-genai, vendor-axios); `console.log/debug/info` dropped in prod via esbuild

## Anti-Patterns (NEVER DO)

- Business logic in components → put in hooks
- Services called directly from components → go through hooks
- API keys in hook state → use `ApiProviderContext`
- Bypass `imageEditingService.ts` for API calls
- Inline styles → use Tailwind
- Feature component without paired hook
- `git reset --hard`, `git clean -fd`, `rm -rf` without explicit user approval
- File deletion without explicit user permission
- Branch `master` — always use `main`

## Known Tech Debt

Components importing services directly (should go through hooks):
`AIEditor`, `ImageEditor`, `LookbookOutput`, `SettingsModal`, `Relight`, `PoseChanger`, `PhotoAlbumCreator`, `OutfitAnalysis`, `shared/RefinementInput`

## Commands

```bash
npm run dev          # Dev server (port 3000)
npm run build        # Production build
npm run test         # Vitest run-once
npm run lint         # ESLint
npx tsc --noEmit     # Type-check
```

## Docs

- Architecture: `docs/system-architecture.md`
- Design system: `docs/design-guidelines.md`
- Code standards: `docs/code-standards.md`
- Codebase summary: `docs/codebase-summary.md`
- API refs: `docs/api/`

---

## 🤖 AI Agent Behavior & Rules (MANDATORY)

### RULE 0 - THE FUNDAMENTAL OVERRIDE PREROGATIVE

If the user tells you to do something, even if it goes against what follows below, YOU MUST LISTEN TO THE USER. THEY ARE IN CHARGE, NOT YOU.

### RULE NUMBER 1: NO FILE DELETION

**YOU ARE NEVER ALLOWED TO DELETE A FILE WITHOUT EXPRESS PERMISSION.** Even a new file that you yourself created. You must always ask and receive clear, written permission before ever deleting a file or folder of any kind.

### Irreversible Git & Filesystem Actions — DO NOT EVER BREAK GLASS

1. **Absolutely forbidden commands:** `git reset --hard`, `git clean -fd`, `rm -rf`, or any command that can delete or overwrite code/data must never be run unless the user explicitly provides the exact command.
2. **No guessing:** If there is any uncertainty about what a command might delete or overwrite, stop immediately and ask for specific approval.
3. **Safer alternatives first:** When cleanup or rollbacks are needed, request permission to use non-destructive options (`git status`, `git diff`, `git stash`, copying to backups) before considering a destructive command.

### Git Branch: ONLY Use `main`, NEVER `master`

**The default branch is `main`.** All work happens on `main`. Never reference `master` in code or docs.

### Third-Party Library Usage

If you aren't 100% sure how to use a third-party library, **SEARCH ONLINE** to find the latest documentation and current best practices. Do not hallucinate APIs.

### Code Editing Discipline

1. **No Script-Based Changes:** **NEVER** run a script that processes/changes code files in this repo using brute-force search & replace (e.g. `sed`). Always make code changes manually or use dedicated semantic refactor tools.
2. **No File Proliferation:** If you want to change something or add a feature, **revise existing code files in place**. **NEVER** create variations like `FeatureV2.tsx` or `Utils_new.ts`.

### Compilation & Lint Checks (CRITICAL)

After any substantive code changes, you MUST verify no errors were introduced:
```bash
npx tsc --noEmit
npm run lint
```
If you see formatting or type errors, carefully understand and resolve each issue. Do NOT just sweep type errors under the rug using `@ts-ignore` or `any` unless absolutely necessary.

### Search Tools (ripgrep vs ast-grep vs AI Semantic Search)

- **Need raw speed or hunting text/literals &rarr;** `rg` (ripgrep) or built-in file finding tools.
- **Exploratory "how does X work?" questions &rarr;** Use AI-powered Code Search (like `ck-search` or `codebase-memory-mcp`) to find relevant snippets without endless manual view_file tracing.
- **Need architectural context &rarr;** Use `trace_call_path` or `get_architecture` from `codebase-memory-mcp`.

### Landing the Plane (Session Completion)

When ending a work session, you MUST complete ALL steps below:
1. **File issues/todos for remaining work** - Document anything that needs follow-up.
2. **Run quality gates** (if code changed) - Linter, Typechecker (tsc), Tests.
3. **Commit work** (if applicable) - Ensure that unfinished work is correctly tracked and not disrupting the `main` application flow.
4. **Hand off & Brain Sync** - Save decisions to your Neural Memory (`nmem_remember` / `nmem_session`) so context carries over. Provide clear context summary for the next session or agent to pick up where you left off.
