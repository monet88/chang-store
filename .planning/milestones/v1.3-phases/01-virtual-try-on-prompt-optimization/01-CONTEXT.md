# Phase 1: Virtual Try-On Prompt Optimization - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** PRD Express Path (docs/superpowers/plans/2026-03-24-tryon-prompt-optimization.md)

<domain>
## Phase Boundary

Refactor the Virtual Try-On prompt builder from text-only `string` return to interleaved `Part[]`, restructure prompt content for better Gemini compliance (narrative rules, recency recap, semantic negatives, pose preservation). Update the hook to call builder per-job inside batch loop. Add comprehensive tests. No changes to Gemini infrastructure (`gemini/image.ts` or service routing).

</domain>

<decisions>
## Implementation Decisions

### Prompt Builder Architecture
- Function renamed from `buildVirtualTryOnPrompt` to `buildVirtualTryOnParts` (returns `Part[]`, not `string`)
- Old `VirtualTryOnFormState` interface deleted entirely — replaced by `VirtualTryOnPromptInput`
- New interface: `{ subjectImage: ImageFile, clothingImages: ImageFile[], extraPrompt: string, backgroundPrompt: string }`
- No `subjectImageCount`/`clothingImageCount`/`numImages` — derived from arrays or unused
- Interleaved image parts with text labels: `[text:"SUBJECT:", img, text:"CLOTHING SOURCE:", img, text:taskText]`
- Dual garment path: `[text:"SUBJECT:", img, text:"TOP GARMENT:", img, text:"BOTTOM GARMENT:", img, text:taskText]`
- Input validation: throw on null subject, empty clothing, >2 clothing items

### Prompt Content Structure
- 6 sections + CRITICAL RECAP: TASK → GARMENT RULES → POSE → BACKGROUND → PROHIBITIONS → CRITICAL RECAP
- Narrative paragraphs with `[CRITICAL]` markers instead of numbered bullet lists
- Pose section condensed from 148 words to 28 words — preserve original pose, no new pose generation
- Semantic positive framing: "tops hang freely outside the waistband" instead of "Do NOT tuck"
- Recency bias: CRITICAL RECAP as final section repeating key rules
- Removed "2K resolution" from prompt (API parameter controls this)
- Each rule stated once per section (no redundancy), recap summarizes

### Hook Integration
- `buildVirtualTryOnParts()` called per-job inside batch loop (subject image embedded in Part[])
- Gemini-only guard before batch loop — non-Gemini models (`local--`, `anti--`) throw i18n error
- `images: []` and `prompt: ''` — Gemini path uses `interleavedParts` exclusively
- `useCallback` dependency array unchanged — builder is pure function import

### i18n & Debug Logging
- New key: `virtualTryOn.geminiOnlyError` in en.ts + vi.ts
- Debug logging: extract text from interleavedParts when prompt is empty for `logApiCall`

### Test Strategy
- Helper functions: `getFullText(parts)`, `getTaskText(parts)`
- Test categories: interleaved structure, input validation, prompt content, garment rules, pose, prohibitions, recap, dual-garment conditional, form state integration, determinism
- Hook integration tests: Gemini-only guard blocks non-Gemini, Gemini path passes interleavedParts

### Agent's Discretion
- Exact mock setup for hook integration tests (depends on current test infrastructure patterns)
- Error logging path for interleavedParts (needs inspection of current error logging in imageEditingService.ts)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prompt Builder
- `src/utils/virtual-try-on-prompt-builder.ts` — Current prompt builder (to be rewritten)
- `src/utils/clothing-transfer-prompt-builder.ts` — Reference pattern for interleaved Part[] (lines 21-28)

### Hook
- `src/hooks/useVirtualTryOn.ts` — Hook that calls builder (lines 148-206 are batch loop)

### Service Layer
- `src/services/imageEditingService.ts` — Unified service facade (debug logging around line 111-118)
- `src/services/gemini/image.ts` — Gemini API layer (interleavedParts path at line 24-25)

### Types & i18n
- `src/types.ts` — `ImageFile` type definition
- `src/locales/en.ts` — English translations
- `src/locales/vi.ts` — Vietnamese translations

### Tests
- `__tests__/utils/virtual-try-on-prompt-builder.test.ts` — Existing tests (to be rewritten)

### PRD (Source of Truth)
- `docs/superpowers/plans/2026-03-24-tryon-prompt-optimization.md` — Full implementation plan with exact code

</canonical_refs>

<specifics>
## Specific Ideas

- Follow exact code from PRD — the prompt text, interface, function signatures are all specified verbatim
- The `buildTaskText()` helper is a private function (not exported) — pure text construction
- Dual-garment conditional: adds waistband-overlap rule only when `clothingImages.length === 2`
- Background section: conditional between "keep original exactly" and "modify with description"
- `extraPrompt` appended after GARMENT RULES section with newline separator

</specifics>

<deferred>
## Deferred Ideas

None — PRD covers phase scope.

</deferred>

---

*Phase: 01-virtual-try-on-prompt-optimization*
*Context gathered: 2026-03-24 via PRD Express Path*
