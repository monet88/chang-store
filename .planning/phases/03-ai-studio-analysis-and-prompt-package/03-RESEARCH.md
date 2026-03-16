# Phase 3: AI Studio Analysis And Prompt Package — Research

**Researched:** 2026-03-16
**Phase Goal:** Users can generate a structured Gemini report with fashion analysis and a per-image prompt package for the active image.
**Requirements:** [ANL-01, ANL-02, PRM-01, PRM-02, PRM-03]

---

## 1. Existing Codebase Patterns

### 1.1 Service Architecture (text → image analysis)

The codebase already has a mature text-from-image pipeline:

| Layer | File | Pattern |
|-------|------|---------|
| Gemini low-level | `services/gemini/text.ts` | Direct `@google/genai` calls with `imagePart + textPart`, structured JSON schema via `responseMimeType: "application/json"`, safety block handling |
| Facade (provider routing) | `services/textService.ts` | Routes by model prefix (`local--`, `anti--`, default Gemini), wraps with `logApiCall`, exports typed helpers |
| Feature hook | `hooks/useUpscale.ts` | Feature-local state, error suggestions, loading messages, builds `ApiConfig` from context |

**Key observation:** Phase 3's analysis service is Gemini-only (per milestone constraint). Unlike `textService.ts` which routes to 3 providers, the new service only needs Gemini. However, following the existing pattern, it should still sit behind a facade function for consistency and logging.

### 1.2 Structured JSON Response Pattern

`gemini/text.ts` → `analyzeOutfit()` already demonstrates Gemini's structured output schema using `Type.OBJECT` and `Type.ARRAY` from `@google/genai`. This is the exact pattern needed for the analysis report schema.

**Relevant code:** `services/gemini/text.ts:197-271` — uses `responseMimeType: "application/json"` + `responseSchema` to enforce typed output.

### 1.3 Upscale Session Model

`types.ts` `UpscaleSessionImage` (lines 147-162) currently stores:
- `id`, `original`, `quickResult`, `quickQuality`, `quickModel`, `studioStep`, `addedAt`

Phase 3 needs to extend this with per-image analysis report and prompt package fields. The `updateSessionImage()` helper in `useUpscale.ts:177-184` already supports partial patching via `Partial<UpscaleSessionImage>`.

### 1.4 Studio Step Shell

`components/upscale/UpscaleStudioStepShell.tsx` has 3 steps defined: `Analyze → Enhance → Export`. Currently a placeholder shell ("Coming soon"). Phase 3 replaces the Analyze step with real UI content. Step navigation is already wired through `setActiveStudioStep` in `useUpscale.ts`.

### 1.5 Locale Pattern

Both `locales/en.ts` and `locales/vi.ts` already have `upscale.studioStep*` keys. Phase 3 needs new keys under the `upscale` namespace for analysis report labels and prompt package UI.

---

## 2. Analysis Report Schema Design

### 2.1 Required Coverage (from ANL-01)

The structured analysis must cover:
- **Garments** — type, cut, construction, styling
- **Materials** — fabric type, texture, weight, sheen
- **Background** — environment, surfaces, depth
- **Lighting** — direction, quality, color temperature, shadows
- **Framing** — shot type, angle, crop, composition
- **Pose** — body position, gesture, expression, movement

### 2.2 Preservation Risk (from ANL-02)

Detail-sensitive areas that need explicit flags:
- Text/logos on garments
- Jewelry with fine details (chains, stones)
- Embroidery/beadwork patterns
- Skin texture and pores
- Hair strand detail
- Fabric weave/knit patterns

### 2.3 Proposed TypeScript Schema

```typescript
/** Structured analysis report from Gemini */
export interface UpscaleAnalysisReport {
  garments: AnalysisGarmentItem[];
  materials: AnalysisMaterialItem[];
  background: AnalysisBackground;
  lighting: AnalysisLighting;
  framing: AnalysisFraming;
  pose: AnalysisPose;
  preservationRisks: PreservationRiskItem[];
}

interface AnalysisGarmentItem {
  name: string;
  type: string;       // e.g., "dress", "jacket"
  description: string; // cut, construction, styling
}

interface AnalysisMaterialItem {
  garment: string;     // which garment this applies to
  fabric: string;      // e.g., "silk", "denim"
  texture: string;     // perceived texture description
  weight: string;      // "light", "medium", "heavy"
  sheen: string;       // "matte", "semi-gloss", "high-sheen"
}

interface AnalysisBackground {
  environment: string; // e.g., "studio", "outdoor park"
  surfaces: string;    // visible textures/surfaces
  depth: string;       // "shallow", "medium", "deep"
  description: string;
}

interface AnalysisLighting {
  direction: string;   // "front", "side", "back", "overhead"
  quality: string;     // "soft diffused", "hard directional"
  colorTemperature: string; // "warm", "neutral", "cool"
  shadows: string;     // description of shadow behavior
}

interface AnalysisFraming {
  shotType: string;    // "full-body", "half-body", "close-up"
  angle: string;       // "straight-on", "slight low", "high"
  composition: string; // "centered", "rule-of-thirds", etc.
}

interface AnalysisPose {
  bodyPosition: string;
  gesture: string;
  expression: string;
  movement: string;    // "static", "implied motion"
}

interface PreservationRiskItem {
  area: string;       // e.g., "logo on t-shirt", "necklace chain"
  riskLevel: 'high' | 'medium' | 'low';
  detail: string;     // why this area is at risk during upscaling
}
```

### 2.4 Gemini Prompt Strategy

Use Gemini's structured output with `responseMimeType: "application/json"` and a `responseSchema` matching the above interface. The system prompt should:
1. Focus on fashion photography analysis (not general scene description)
2. Explicitly ask for preservation risk identification
3. Use the existing `thinkingConfig` pattern for higher quality output
4. Set model to `gemini-2.5-flash` for cost efficiency (analysis doesn't need Pro)

---

## 3. Prompt Package Design

### 3.1 Requirements Recap

- **PRM-01**: One copy-ready English master prompt per image
- **PRM-02**: Prioritize faithful upscale/preservation over creative restyling
- **PRM-03**: Per-image storage, used for later inline upscale (Phase 4)

### 3.2 Prompt Generation Strategy

The master prompt should be auto-generated from the analysis report, NOT from a second Gemini call. This keeps it deterministic and fast. The generation logic:

1. Take the analysis report sections
2. Compose a preservation-first upscale prompt that references specific garments, materials, lighting, and at-risk areas
3. Format as a single English paragraph ready for Gemini image-edit API

**Template structure:**
```
Upscale this fashion photograph to {resolution}. Preserve [garment details from analysis]. 
Maintain [material textures]. Keep [lighting setup]. Retain [pose/expression]. 
CRITICAL PRESERVATION: [high-risk areas from preservationRisks]. 
Photorealistic, fashion photography quality.
```

### 3.3 Storage in Session Model

Extend `UpscaleSessionImage` with:
```typescript
/** AI Studio analysis report (null until generated) */
analysisReport: UpscaleAnalysisReport | null;
/** AI Studio generated prompt package (null until generated) */
studioPrompt: string | null;
```

---

## 4. Service Layer Design

### 4.1 New Service File: `services/upscaleAnalysisService.ts`

Following the facade pattern, this service should:
1. Be Gemini-only (no provider routing — milestone constraint)
2. Use `getGeminiClient()` from `apiClient.ts`
3. Handle JSON parsing and validation
4. Export a clean typed function

```typescript
export async function analyzeImageForUpscale(
  image: ImageFile,
  model?: string
): Promise<UpscaleAnalysisReport>

export function generateUpscalePrompt(
  report: UpscaleAnalysisReport,
  quality: UpscaleQuality
): string
```

**Design choice:** `generateUpscalePrompt` is a pure function (no API call). It composes the prompt from the analysis report locally. This is deterministic, instant, and testable.

### 4.2 Error Handling

Follow existing pattern from `gemini/text.ts`:
- Check `promptFeedback.blockReason`
- Check `candidates.length`
- Check `finishReason` for safety blocks
- Wrap in `error.api.*` error codes for i18n

---

## 5. UI Component Design

### 5.1 UpscaleStudioStepShell Evolution

The current shell needs to become a container that renders step-specific content. For Phase 3, only the **Analyze** step gets real UI. The **Enhance** and **Export** steps remain placeholder shells.

### 5.2 New Component: `UpscaleAnalyzeStep.tsx`

Content for the Analyze step when `studioStep === 'analyze'`:
- "Generate Analysis" button (triggers API call)
- Loading state with progress message
- Analysis report display (structured cards for each section)
- Preservation risk highlights (warning badges)
- Generated prompt display with copy button
- Prompt guidance note (preservation > creative)

### 5.3 Analysis Report Display

Use collapsible sections matching the schema:
- 👗 Garments
- 🧵 Materials
- 🏞️ Background
- 💡 Lighting
- 📐 Framing
- 🧍 Pose
- ⚠️ Preservation Risks (always visible/expanded)

### 5.4 Prompt Package Display

- Read-only text area with the generated prompt
- Copy to clipboard button
- Small guidance note: "This prompt prioritizes faithful detail preservation. For creative alternatives, use the settings in Phase 4."

---

## 6. Hook Extension

### 6.1 `useUpscale` Changes

Add to hook state and return:
```typescript
// New state
isAnalyzing: boolean;
analysisError: string | null;

// New actions
handleAnalyzeImage: () => Promise<void>;
```

The `handleAnalyzeImage` function:
1. Guards: requires `activeImage`, checks Gemini-only model
2. Sets `isAnalyzing = true`
3. Calls `analyzeImageForUpscale(image)`
4. Generates prompt via `generateUpscalePrompt(report, quality)`
5. Patches `activeImage` with `analysisReport` and `studioPrompt`
6. Auto-advances studio step to `Enhance` on success
7. Handles errors with appropriate i18n error messages

---

## 7. Localization Impact

New keys needed under `upscale.*`:
- `studioAnalyzeButton` — "Generate Analysis"
- `studioAnalyzing` — "Analyzing image..."
- `studioAnalysisComplete` — "Analysis complete"
- `studioPromptReady` — "Upscale prompt generated"
- `studioPromptCopied` — "Prompt copied to clipboard"
- `studioPromptGuidance` — preservation-first guidance note
- `studioPreservationRisk` — "Preservation Risks"
- `studioGarments` — "Garments"
- `studioMaterials` — "Materials"
- `studioBackground` — "Background"
- `studioLighting` — "Lighting"
- `studioFraming` — "Framing"
- `studioPose` — "Pose"
- `studioRiskHigh/Medium/Low` — risk level labels
- Error keys: `studioAnalysisFailed`, `studioGeminiOnly`

---

## 8. Testing Strategy

### 8.1 Unit Tests

- `upscaleAnalysisService.test.ts` — mock Gemini client, test schema validation, error handling, prompt generation
- `useUpscale.test.ts` — extend existing tests for analysis flow, state transitions, error states
- `UpscaleAnalyzeStep.test.tsx` — render tests for report display, button states, copy behavior

### 8.2 Key Test Scenarios

1. Happy path: upload → analyze → report displayed → prompt generated → copied
2. Safety block: Gemini returns safety block → error displayed → retryable
3. Invalid schema: Gemini returns malformed JSON → graceful error
4. Non-Gemini model: local/anti model selected → clear "Gemini only" error
5. Per-image isolation: Image A has analysis, switch to Image B → shows no analysis
6. Step progression: analysis completes → step auto-advances to Enhance

---

## 9. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Gemini returns inconsistent JSON structure | Medium | Use `responseSchema` with required fields; validate response shape |
| Safety blocks on fashion images | Low-Medium | Follow existing safety block pattern; provide retry guidance |
| Analysis too slow (>10s) | Low | Use Flash model; show clear progress; analysis is one-time per image |
| Prompt too generic from analysis | Medium | Template uses concrete analysis data not vague descriptions |
| Token limits on detailed analysis | Low | Fashion images are within standard image input size |

---

## 10. Validation Architecture

### Dimension 1: Functional Correctness
- Analysis report returned with all 6 sections populated
- Preservation risks identified for detail-sensitive areas
- Prompt generated as copy-ready English text
- Per-image isolation maintained

### Dimension 2: Error Handling
- Safety block produces user-visible error
- Invalid JSON produces user-visible error
- Non-Gemini model produces "Gemini only" error
- Network failure produces retry guidance

### Dimension 3: State Integrity
- `analysisReport` stored per-image in session array
- `studioPrompt` stored per-image in session array
- Mode/step transitions don't lose analysis data
- Session image removal cleans up analysis data

### Dimension 4: UI Consistency
- Analysis report uses existing upscale UI patterns (zinc tones, rounded cards)
- Loading states match Quick Upscale loading pattern
- Error display follows existing errorSuggestion pattern
- Copy button uses standard clipboard API

---

## RESEARCH COMPLETE
