# Chang-Store — Copilot Workspace Instructions

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with multiple AI backends (Google Gemini, Local Provider, Anti Provider).

## Architecture

```
Component (thin UI) → Hook (state + logic) → Service Facade → Provider API
```

**Provider nesting order** (each depends on parent):

```
LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider → AppContent
```

> **Note**: `ToastProvider` lives in `components/Toast.tsx` (not in `contexts/`). All others are in `contexts/`.

**Service routing** — model prefix determines backend (`services/imageEditingService.ts`):

| Prefix | Backend | Service file |
|--------|---------|-------------|
| `local--` | Local Provider (REST) | `localProviderService.ts` |
| `anti--` | Anti Provider (REST) | `antiProviderService.ts` |
| _(none)_ | Google Gemini SDK | `gemini/image.ts` |

**Path alias**: `@/*` maps to project root (not `src/`).

**Feature routing**: No React Router. `App.tsx` → `AppContent` uses a switch on `Feature` enum to render lazy-loaded components.

## Project Structure

| Directory | Role | Details |
|-----------|------|---------|
| `components/` | UI layer (~50 components) | See `components/AGENTS.md` |
| `hooks/` | Feature logic (15 hooks) | See `hooks/AGENTS.md` |
| `services/` | API facades (stateless, 11 files) | See `services/AGENTS.md` |
| `contexts/` | Global state (5 contexts) | See `contexts/AGENTS.md` |
| `utils/` | Pure helpers (15 files) | See `utils/AGENTS.md` |
| `config/` | Model capability registry | `modelRegistry.ts` |
| `locales/` | i18n (`en.ts`, `vi.ts`) | English is source of truth |
| `__tests__/` | Mirrors source structure (~25 files) | See `__tests__/AGENTS.md` |

> Source code lives at **project root** (not under `src/`). `src/` only contains `index.css`.

## Key Patterns

### Every feature = Component + Hook

```typescript
// Component: thin wrapper, NO business logic
const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();
  return <UI state={state} onAction={handlers.action} />;
};

// Hook: state, API calls, gallery integration
export function useFeatureName() {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  const { getModelsForFeature } = useApi();
  return { state: { results, isLoading }, handlers: { handleGenerate } };
}
```

### Adding a new feature

1. Add enum value in `types.ts` → `Feature`
2. Create `components/FeatureName.tsx` (thin UI)
3. Create `hooks/useFeatureName.ts` (all logic)
4. Add case in `App.tsx` switch + lazy import
5. Add i18n keys in `locales/en.ts` (source of truth), then `locales/vi.ts`
6. Add service routing in `imageEditingService.ts` if new API call needed

### Import order

1. React + external libs
2. Internal contexts/hooks
3. Internal services/utils
4. Types

### Error handling in hooks

```typescript
try { ... } catch (err) { setError(getErrorMessage(err, t)); } finally { setIsLoading(false); }
```

## Conventions

- **Tailwind only** — no inline styles, no `@apply`
- **Dark glassmorphism** theme — see `docs/design-guidelines.md`
- **i18n**: `const { t } = useLanguage(); t('key.path')` — `locales/en.ts` is source of truth
- **No business logic in components** — extract to hooks
- **No direct API calls from hooks** — go through service facades
- **PascalCase** filenames for components (`.tsx`), camelCase for hooks/services (`.ts`)
- **`React.FC`** type annotation on components
- **Interface over type** for object shapes; avoid `any`
- **Build optimizations**: manual chunk splitting (vendor-react, vendor-genai, vendor-axios), esbuild drops console in prod

## Detailed Docs (link, don't duplicate)

- **Architecture**: `docs/system-architecture.md`
- **Design system**: `docs/design-guidelines.md`
- **Code standards**: `docs/code-standards.md`
- **Codebase summary**: `docs/codebase-summary.md`
- **API docs**: `docs/api/` (Gemini, Imagen, Nano Banana)

## Anti-Patterns

- Never put business logic in components — use hooks
- Never call services directly from components — go through hooks
- Never store API keys in hooks — use `ApiProviderContext`
- Never bypass `imageEditingService.ts` facade for API calls
- Never add inline styles — use Tailwind utilities
- Never create feature components without a corresponding hook

## Known Violations (Tech Debt)

These components import services directly (should go through hooks):
`AIEditor`, `ImageEditor`, `LookbookOutput`, `SettingsModal`, `Relight`, `PoseChanger`, `PhotoAlbumCreator`, `OutfitAnalysis`, `shared/RefinementInput`

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
