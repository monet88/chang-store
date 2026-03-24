# SERVICES - API Facade Layer

## OVERVIEW
Stateless facades routing requests by model prefix to Gemini, Local Provider, or Anti Provider. Prompt engineering in `gemini/`.

## STRUCTURE
```
services/
├── imageEditingService.ts      # UNIFIED FACADE - edit/generate/upscale routing
├── textService.ts              # Text generation facade with same routing
├── upscaleAnalysisService.ts   # Multi-phase upscale analysis + prompt generation
├── apiClient.ts                # Gemini SDK singleton + key management
├── localProviderService.ts     # Local/Proxypal REST calls
├── antiProviderService.ts      # Anti Provider REST calls
├── debugService.ts             # Debug logging utility (logApiCall)
├── googleDriveService.ts       # Cloud storage sync (optional)
└── gemini/
    ├── image.ts                # Image generation prompts + SDK calls
    ├── text.ts                 # Text generation prompts
    └── video.ts                # Video prompts + polling
```

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| Add AI feature | `imageEditingService.ts` | Add to routing switch |
| Modify prompts | `gemini/image.ts` or `gemini/text.ts` | Prompt templates |
| Upscale analysis | `upscaleAnalysisService.ts` | Quality analysis + prompt generation |
| Video generation | `gemini/video.ts` | Complex polling logic |
| API client config | `apiClient.ts` | Gemini SDK singleton |
| Debug API calls | `debugService.ts` | Enable via localStorage |

## MODEL ROUTING
```typescript
// imageEditingService.ts + textService.ts
const LOCAL_PREFIX = 'local--';   // → localProviderService
const ANTI_PREFIX  = 'anti--';    // → antiProviderService
// Default (no prefix / gemini-*)  → Gemini SDK
```

## ERROR HANDLING
- All errors use i18n keys: `error.api.safetyBlock`, `error.api.noContent`, etc.
- `normalizeError()` in Local/Anti services preserves i18n keys
- Gemini checks: `promptFeedback.blockReason`, empty candidates, `finishReason`
- Status updates via `onStatusUpdate` callback in service config

## ANTI-PATTERNS
- **NEVER** call external APIs directly from hooks — use facades
- **NEVER** store state in services — use contexts
- **DO NOT** hardcode API keys — use `ApiProviderContext`

## COMPLEXITY HOTSPOTS
| File | Lines | Issue |
|------|-------|-------|
| `gemini/video.ts` | ~759 | Prompt builder bloat — extract prompt templates |
| `imageEditingService.ts` | ~483 | Large facade — acceptable for routing complexity |
