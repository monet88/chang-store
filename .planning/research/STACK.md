# Stack Research

**Domain:** Hybrid Upscale workflow for AI fashion lookbook images in an existing browser-only React SPA  
**Researched:** 2026-03-16  
**Confidence:** High

## Recommended Stack

### Core

| Technology | Purpose | Why |
|------------|---------|-----|
| Existing React 19 + TypeScript + Vite SPA | Keep all new Upscale UX in the current app | Milestone is explicitly browser-only and already fits the repo's component -> hook -> service pattern |
| `@google/genai` | Image-in, structured text-out analysis and report generation | Reuse existing SDK and Gemini multimodal capabilities for fashion analysis, prompt generation, and simulated preview text |
| Gemini text/multimodal path for AI Studio | Structured fashion analysis, prompt package, simulated preview description | Better fit than image-generation APIs because this lane needs reliable text/JSON, not image output |
| Existing `services/imageEditingService.ts` path | Preserve direct in-app upscale | Current fast path already works and should remain first-class |

### Supporting Additions

| Addition | Purpose | Recommendation |
|----------|---------|----------------|
| Runtime schema validation | Normalize and validate AI Studio report objects before rendering | Recommended; use a lightweight schema helper and only add a dependency if the implementation needs stronger runtime guarantees |
| Static tool-guide definitions | Keep Gemini, Midjourney, Krea, Leonardo, Topaz, Make, and Zapier guidance data-driven | Recommended; do not add external SDKs in this milestone |
| Existing Vitest + RTL stack | Test parsing, fallback behavior, and direct-upscale regression | Required for the new service/hook split |

## Use / Avoid

### Use

- Existing SPA architecture
- Existing provider configuration contexts
- Existing direct-upscale service route
- Structured AI output for the guidance lane
- Data-driven tool cards and copy blocks

### Avoid

- New backend proxy/server in this milestone
- Direct Midjourney/Krea/Leonardo/Topaz/Make/Zapier integrations
- New state-management framework
- Fake image-preview generation for the simulated result
- A catch-all expansion of `services/imageEditingService.ts`

## Integration Points

- `components/Upscale.tsx` remains screen entry
- New runtime hook should own orchestration
- New AI Studio service should live beside, not inside, the direct image-upscale service flow
- New prompt/schema/tool-guide helpers should stay outside UI code
- New locale keys should be added in both `locales/en.ts` and `locales/vi.ts`

## Key Recommendation

Keep the current direct upscale path intact, and add a separate structured-report lane powered by Gemini multimodal analysis plus deterministic UI-safe parsing.

## Unresolved Questions

- Whether runtime validation needs a new dependency or can stay dependency-light
- Whether AI Studio guidance should expose one recommended tool or a ranked set of tool cards
