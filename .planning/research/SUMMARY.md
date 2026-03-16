# Research Summary

**Milestone:** v1.0 Improve Upscale Feature  
**Summarized:** 2026-03-16

## Stack Additions

- Reuse the current React + TypeScript + Vite SPA
- Preserve direct in-app upscale on the existing image service path
- Add a new text-first AI Studio service path for structured guidance
- Keep tool guidance data-driven and avoid live external integrations in this milestone

## Feature Table Stakes

- Preserve the current fast `Quick Upscale` flow
- Add structured fashion-image analysis
- Add copy-ready English prompt output
- Add simulated textual preview of likely upscale outcome
- Add tool-specific next-step guidance
- Add trust-oriented warnings around hallucination and drift

## Architectural Direction

- Refactor `components/Upscale.tsx` into a thin screen
- Add `hooks/useUpscale.ts` as the canonical runtime hook
- Add a dedicated `upscaleStudioService` for the guided lane
- Keep direct upscale and AI Studio as two sibling flows on the same screen

## Watch Out For

- Do not bury the current fast path
- Do not present simulated preview as a guaranteed result
- Do not assume one prompt works equally across all tools
- Do not leak provider logic into UI code
- Do not expand this milestone into real third-party integrations

## Recommended Scope for Requirements

1. Preserve quick direct upscale and compare flow
2. Add a structured AI Studio report
3. Add a polished English prompt package
4. Add tool-specific guidance and warnings
5. Keep automation guidance instructional only

## Recommended Default Decisions

- AI Studio should be a parallel lane, not a replacement
- Studio report can be Gemini-first in v1 if unsupported providers get clear messaging
- Simulated preview stays textual
- Base prompt targets faithful upscale and preservation first, not creative restyling
- Tool cards can all render, with one highlighted “recommended next step”

## Unresolved Questions

- Whether runtime validation should stay dependency-light or use a dedicated schema library
- Whether v1 automation guidance should include a copyable payload block
