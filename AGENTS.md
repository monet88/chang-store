# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with multiple AI backends (Google Gemini, Local Provider, Anti Provider).

## Providers (Settings)
- Google
- Proxypal Provider (local)
- Anti Provider

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

## Issue Tracking

This repository does not currently use a git-tracked issue metadata workflow.

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
| `services/` | API integrations: Gemini, Local, Anti |
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
const model = "local--model-name";     // → Local Provider
const model = "anti--model-name";      // → Anti Provider
const model = "gemini-2.5-flash";      // → Gemini (default)
```

## External APIs

| Service | Auth |
|---------|------|
| Google Gemini (`@google/genai`) | `GEMINI_API_KEY` env or Settings |
| Local Provider | Base URL + API Key in Settings |
| Anti Provider | Base URL + API Key in Settings |

## i18n

- Source: `locales/en.ts` (exports `Translation` type)
- Usage: `const { t } = useLanguage(); t('key.path')`

## Development Notes

- Local storage persistence enabled for settings (API keys, provider config, model selections); gallery remains session-only
- Images stored in-memory via `ImageGalleryContext` (session only)
- Generated images go through `addImage()` from gallery context


## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY

**CRITICAL**: This project has CodeSeeker MCP tools available. You MUST use them as your PRIMARY method for code discovery, NOT grep/glob.

### Auto-Initialization Check

**BEFORE any code search**, verify the project is indexed:
1. Call `projects()` to see indexed projects
2. If this project is NOT listed, call `index({path: "PROJECT_ROOT_PATH"})` first
3. If tools return "Not connected", the MCP server may need restart

### When to Use CodeSeeker (DEFAULT)

**ALWAYS use CodeSeeker for these queries:**
- "Where is X handled?" → `search({query: "X handling logic"})`
- "Find the auth/login/validation code" → `search({query: "authentication"})`
- "How does Y work?" → `search({query: "Y implementation", read: true})`
- "What calls/imports Z?" → `analyze({action: "dependencies", filepath: "path/to/Z"})`
- "Show me the error handling" → `search({query: "error handling patterns", read: true})`

| Task | MUST Use | NOT This |
|------|----------|----------|
| Find code by meaning | `search({query: "authentication logic"})` | ❌ `grep -r "auth"` |
| Search + read files | `search({query: "error handling", read: true})` | ❌ `grep` then `cat` |
| Show dependencies | `analyze({action: "dependencies", filepath: "..."})` | ❌ Manual file reading |
| Find patterns | `analyze({action: "standards"})` | ❌ Searching manually |
| Understand a file | `search({filepath: "..."})` | ❌ Just Read alone |

### When to Use grep/glob (EXCEPTIONS ONLY)

Only fall back to grep/glob when:
- Searching for **exact literal strings** (UUIDs, specific error codes, magic numbers)
- Using **regex patterns** that semantic search can't handle
- You **already know the exact file path**

### Why CodeSeeker is Better

```
❌ grep -r "error handling" src/
   → Only finds literal text "error handling"

✅ search("how errors are handled")
   → Finds: try-catch blocks, .catch() callbacks, error responses,
     validation errors, custom Error classes - even if they don't
     contain the words "error handling"
```

### Available MCP Tools (3 consolidated)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `search({query})` | Semantic search | First choice for any "find X" query |
| `search({query, read: true})` | Search + read combined | When you need file contents |
| `search({filepath})` | File + related code | Reading a file for the first time |
| `analyze({action: "dependencies", filepath})` | Dependency graph | "What uses this?" |
| `analyze({action: "standards"})` | Project patterns | Before writing new code |
| `analyze({action: "duplicates"})` | Find duplicate code | Code cleanup |
| `analyze({action: "dead_code"})` | Find unused code | Architecture review |
| `index({action: "init", path})` | Index a project | If project not indexed |
| `index({action: "sync", changes})` | Update index | After editing files |
| `index({action: "status"})` | Show indexed projects | Check if project is indexed |

### Keep Index Updated

After using Edit/Write tools, call:
```
index({action: "sync", changes: [{type: "modified", path: "path/to/file"}]})
```

## Claude Code Best Practices (from 2000+ hours of expert usage)

### Subagent Strategy for Complex Tasks
- For multi-step or complex tasks, spawn subagents using the **main model** (not cheaper/smaller models) instead of cramming everything into one context
- Pattern: "Orchestrator coordinates + focused subagents execute" >> "Single massive context"
- Use subagents MORE than you think necessary, especially for large codebases
- Each subagent gets fresh, focused context = better quality output

### Context Hygiene - Prevent "Lost in the Middle"
- Quality degrades as context grows - the "lost in the middle" problem is real
- Use **double-escape (Esc Esc)** to time travel when context gets polluted with failed attempts
- Compact strategically and intentionally, not automatically
- When output quality drops, consider starting fresh rather than adding more context

### Error Attribution Mindset
- Issues in AI-generated code trace back to **prompting or context engineering**
- When something fails, ask "what context was missing?" not "the AI is broken"
- Log failures mentally: prompt → context → outcome. Patterns will emerge.
- Better input = better output. Always.

