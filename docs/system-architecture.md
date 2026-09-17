# System Architecture

This file is the legacy/living system architecture entrypoint. The detailed
Harness-era architecture doc is `docs/ARCHITECTURE.md`.

## Architecture Overview

Chang Store is a client-only React/Vite SPA:

```text
React Component
  → Feature Hook
    → Service Facade
      → Gemini SDK
        → Google Gemini API
```

There is no custom backend server. Persistence is browser-local.

## Component Roles

| Layer | Responsibility |
| --- | --- |
| Components | Render UI and dispatch events |
| Hooks | Manage feature state, API orchestration, error handling |
| Services | Stateless provider/API wrappers |
| Utils | Prompt builders, image helpers, storage/download helpers |
| Contexts | App-wide state providers |

## Global State Providers

Provider order:

```text
LanguageProvider
  → ToastProvider
    → ApiProvider
      → ImageGalleryProvider
        → ImageViewerContext
          → AppContent
```

## Feature Routing

`App.tsx` switches on `Feature` enum values and lazy-loads feature components.
No React Router is used.

## Studio Modes

`AppContent` holds a `StudioMode` (`gemini | grok | gptImage`, default
`gemini`), toggled by the header `StudioModeSwitch`. The Gemini studio uses the
pipeline above. The Grok and GPT Image studios are isolated: separate model
registries (`grokModelRegistry.ts`, `gptImageModelRegistry.ts`) and services
(`src/services/providers/grok`, `gpt-image`, with `shared/` helpers), no Gemini
pipeline calls, and local-only results (no Gallery writes). See
`docs/ARCHITECTURE.md` "Studio Modes" and `docs/product/provider-studios.md`.

## Model Registry

`src/config/modelRegistry.ts` defines selectable model IDs, labels, selection
types, and capabilities such as aspect ratio and image size support.

## Error Handling Pattern

Feature hooks should use:

```ts
try {
  // API call
} catch (err) {
  setError(getErrorMessage(err, t));
} finally {
  setIsLoading(false);
}
```

## Data Persistence Layer

- IndexedDB: gallery and image cache.
- localStorage: session state and preferences.

## Prompt Builder Pattern

Feature-specific prompt construction lives in `src/utils/*-prompt-builder.ts`.
This keeps prompts testable and prevents prompt logic from leaking into UI.

## Batch Processing

Batch-capable features use bounded workers, per-item statuses, and ZIP download
helpers where appropriate.
