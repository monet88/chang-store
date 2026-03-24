# SERVICES - API Facade Layer

## OVERVIEW
Stateless facades routing requests by model prefix to Gemini, Local Provider, or Anti Provider. No state stored here — all state in contexts/hooks.

## STRUCTURE
```
services/
├── imageEditingService.ts      # UNIFIED FACADE — edit/generate/upscale routing (~483 lines)
├── textService.ts              # Text generation facade (same prefix routing)
├── upscaleAnalysisService.ts   # Multi-phase upscale: analysis + prompt generation
├── apiClient.ts                # Gemini SDK singleton + key management
├── localProviderService.ts     # Local/Proxypal REST calls
├── antiProviderService.ts      # Anti Provider REST calls
├── debugService.ts             # Debug logging (logApiCall, enabled via localStorage)
├── googleDriveService.ts       # Cloud storage sync (optional, requires OAuth)
└── gemini/
    ├── image.ts                # Image generation: prompts + SDK calls
    ├── text.ts                 # Text generation prompts
    └── video.ts                # Video prompts + polling (~759 lines, prompt bloat)
```

## MODEL ROUTING
```typescript
// In imageEditingService.ts + textService.ts
const LOCAL_PREFIX = 'local--';   // → localProviderService
const ANTI_PREFIX  = 'anti--';    // → antiProviderService
// Default (no prefix / gemini-*) → Gemini SDK (gemini/image.ts)
```

## WHERE TO LOOK
| Task | File | Notes |
|------|------|-------|
| Add AI feature routing | `imageEditingService.ts` | Add to routing switch |
| Modify image prompts | `gemini/image.ts` | Prompt templates per feature |
| Modify text prompts | `gemini/text.ts` | Text generation templates |
| Upscale analysis | `upscaleAnalysisService.ts` | Quality analysis + prompt generation |
| Video generation | `gemini/video.ts` | Complex polling logic |
| API client config | `apiClient.ts` | Gemini SDK singleton |
| Debug API calls | `debugService.ts` | Enable via localStorage flag |

## ERROR HANDLING
- i18n error keys: `error.api.safetyBlock`, `error.api.noContent`, etc.
- `normalizeError()` in Local/Anti services preserves i18n keys
- Gemini checks: `promptFeedback.blockReason`, empty candidates, `finishReason`
- Status updates via `onStatusUpdate` callback in service config object

## ANTI-PATTERNS
- **NEVER** call external APIs directly from hooks — use facades
- **NEVER** store state in services — use contexts
- **DO NOT** hardcode API keys — use `ApiProviderContext`

## COMPLEXITY HOTSPOTS
| File | Lines | Note |
|------|-------|------|
| `gemini/video.ts` | ~759 | Prompt builder bloat — extract templates |
| `imageEditingService.ts` | ~483 | Large facade — acceptable routing complexity |
