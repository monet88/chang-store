# SERVICES - API Facade Layer

## OVERVIEW

9 service files: unified facade routing to Gemini or AIVideoAuto backends. Prompt Engineering as Code in `gemini/`.

## STRUCTURE

```
services/
├── imageEditingService.ts  # UNIFIED FACADE - routes by model prefix
├── apiClient.ts            # Gemini client singleton
├── geminiService.ts        # Gemini direct calls
├── aivideoautoService.ts   # AIVideoAuto API calls
├── tauriService.ts         # Desktop IPC bridge
├── googleDriveService.ts   # Cloud storage (optional)
└── gemini/
    ├── image.ts            # Image generation prompts
    ├── text.ts             # Text generation prompts
    └── video.ts            # Video prompts (759 lines - needs refactor)
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add AI feature | `imageEditingService.ts` | Add to routing switch |
| Modify prompts | `gemini/image.ts` or `gemini/text.ts` | Prompt templates |
| Video generation | `gemini/video.ts` | Complex polling logic |
| Desktop save | `tauriService.ts` | IPC to Rust backend |
| API client config | `apiClient.ts` | Gemini SDK setup |

## MODEL ROUTING

```typescript
// In imageEditingService.ts
function routeRequest(model: string) {
  if (model.startsWith("aivideoauto--")) {
    return aivideoautoService.process(...);
  }
  return geminiService.process(...);
}
```

## CONVENTIONS

- Services are stateless facades
- Singletons for API clients (`apiClient.ts`)
- Async/await throughout
- Error messages via `getErrorMessage(err, t)` for i18n

## ANTI-PATTERNS

- **NEVER** call external APIs directly from hooks - use services
- **NEVER** store state in services - use contexts
- **Video features** MUST route to AIVideoAuto (not Gemini)
- **DO NOT** hardcode API keys - use ApiContext

## PROMPT ENGINEERING

```typescript
// gemini/*.ts pattern
export function buildPrompt(params: FeatureParams): string {
  return `System: You are a fashion AI...
  
  User request: ${params.description}
  Style: ${params.style}`;
}
```

## COMPLEXITY HOTSPOTS

| File | Lines | Issue | Action |
|------|-------|-------|--------|
| `gemini/video.ts` | 759 | Prompt builder bloat | Extract prompt templates |
