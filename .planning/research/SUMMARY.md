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

## Scope Override

- User clarified after research review that this milestone should be **Gemini-only**
- User clarified the whole guided workflow should stay **fully inside Upscale Feature**
- User clarified the feature should support **multiple uploaded images** in the same Upscale session
- User clarified `Quick Upscale` must support **both 2K and 4K**
- User clarified `AI Studio` should expose an inline **Upscale** action right after prompt generation for each image
- Ignore third-party execution cards and automation playbooks in the roadmap
- Keep research findings that still apply to hybrid IA, trust, and architecture

## Recommended Scope for Requirements

1. Preserve quick direct upscale and compare flow
2. Add multiple-image handling inside Upscale
3. Add 2K and 4K support to Quick Upscale
4. Add a structured AI Studio report
5. Add a polished per-image English prompt package for Gemini
6. Add inline Upscale execution from the AI Studio prompt step
7. Add Gemini-specific guidance and warnings
8. Keep the milestone free of third-party tool integration

## Recommended Default Decisions

- AI Studio should be a parallel lane, not a replacement
- Studio report should be Gemini-only in v1, with clear unsupported-provider messaging
- The entire step-based pipeline should live inside the Upscale screen, not other features
- Multiple uploaded images should be supported in the same Upscale session
- Quick Upscale should keep 2K and 4K while reusing the same preservation-first prompt intent
- AI Studio prompt generation should lead directly to an inline Upscale action for the active image
- Simulated preview stays textual
- Base prompt targets faithful upscale and preservation first, not creative restyling
- Guided output should focus on Gemini workflow only

## Unresolved Questions

- Whether runtime validation should stay dependency-light or use a dedicated schema library
