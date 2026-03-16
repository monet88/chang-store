# Pitfalls Research

**Domain:** Hybrid Upscale workflow in an existing AI fashion studio  
**Researched:** 2026-03-16  
**Confidence:** High

## Major Risks

### 1. Burying the fast path

If the current quick upscale flow becomes a slow wizard, the feature regresses for existing users.

**Prevent:** Keep `Quick Upscale` visually first-class and separate from the guided lane.

### 2. Fake structured analysis

If AI Studio output looks structured in the UI but comes from brittle freeform text, the feature will be unstable and hard to trust.

**Prevent:** Define a stable report contract and normalize/validate the response before rendering.

### 3. Overpromising the simulated preview

If the “preview” is presented like a guaranteed outcome, users will treat it as truth and lose trust when downstream tools differ.

**Prevent:** Label it clearly as a simulated textual expectation, not a real generated preview.

### 4. One-prompt-fits-all guidance

Midjourney, Krea, Leonardo, Gemini, and Topaz do not behave the same way.

**Prevent:** Use one base prompt plus tool-specific adapter notes and warnings.

### 5. Provider logic leaking into the UI

This breaks repo conventions and makes the feature harder to maintain.

**Prevent:** Keep provider routing and AI-studio orchestration in hook/service layers.

### 6. Async state collisions

Direct upscale and AI Studio can both be loading, failing, or clearing state.

**Prevent:** Use separate loading/error channels and invalidate both outputs when source image changes.

### 7. Scope creep into real integrations

Make/Zapier/Topaz/Midjourney/Krea/Leonardo live execution would explode the milestone scope.

**Prevent:** Keep those paths guidance-only in v1.0.

## Roadmap Implications

- Early phase should lock IA and fast-path preservation
- Service phase should absorb schema validation and response fallback
- Prompt/tool phase should absorb tool-specific adapters and warning language
- Automation phase should keep a hard boundary around “guidance only”
- Hardening phase should cover latency, blocked-response UX, and test coverage

## Recommended Guardrails

- Never hide `Quick Upscale`
- Never present simulated output as guaranteed
- Never imply Make/Zapier flows execute inside the app
- Never duplicate provider routing outside the service layer
- Never let the tested path diverge from the runtime path

## Unresolved Questions

- Whether the guided lane should recommend one best tool or expose all equally
- Whether v1.0 should require strict JSON or accept structured-enough sections with repair
- How strong the automation disclaimer language should be
