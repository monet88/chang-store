# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with dual AI backends (Google Gemini, AIVideoAuto).

## Commands

```bash
# Web Development
npm run dev           # Dev server @ localhost:3000
npm run build         # Production build
npm run lint          # ESLint
npm run test          # Vitest
npm run test -- --coverage  # With coverage
npm run test:ui       # Vitest UI

```

## Issue Tracking (Beads)

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Start**: Run `bd ready` to find actionable work
2. **Claim**: Use `bd update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `bd close <id>`
5. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->

## Architecture

```
Component (UI) → Hook (Logic) → Service (API Facade) → External APIs
```

**Provider Stack:**
```
LanguageProvider → ApiProvider → ImageGalleryProvider → ImageViewerProvider → App
```

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `components/` | Feature UIs (14) + Shared (10) + Modals (5) |
| `hooks/` | Feature-specific hooks - all business logic |
| `contexts/` | Global state: API keys, language, gallery, viewer |
| `services/` | API integrations: Gemini, AIVideoAuto |
| `utils/` | imageUtils.ts, lookbookPromptBuilder.ts |
| `locales/` | i18n: en.ts (source), vi.ts |

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Provider stack + feature router |
| `types.ts` | ImageFile, Feature enum, AspectRatio |
| `services/imageEditingService.ts` | Unified facade - routes by model prefix |
| `services/apiClient.ts` | Gemini client singleton |

## Code Patterns

### Component → Hook separation
```typescript
// Component: thin UI
export const FeatureName: React.FC = () => {
  const { state, handlers } = useFeatureName();
  return <UI state={state} onAction={handlers.action} />;
};

// Hook: all logic
export function useFeatureName() {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  return { state, handlers };
}
```

### Service Routing
```typescript
const model = "aivideoauto--model-name";  // → AIVideoAuto
const model = "gemini-2.5-flash";          // → Gemini
```

## External APIs

| Service | Auth |
|---------|------|
| Google Gemini (`@google/genai`) | `GEMINI_API_KEY` env or Settings |
| AIVideoAuto (`api.gommo.net/ai`) | access_token in Settings |

## i18n

- Source: `locales/en.ts` (exports `Translation` type)
- Usage: `const { t } = useLanguage(); t('key.path')`

## Development Notes

- Local storage persistence enabled for settings (API keys, provider config, model selections); gallery remains session-only
- Images stored in-memory via `ImageGalleryContext` (session only)
- Generated images go through `addImage()` from gallery context
- Video generation uses polling (Gemini: indefinite, AIVideoAuto: 10min max)
