# Roadmap: Chang-Store

## Overview

This milestone upgrades Upscale from a single-image utility into a self-contained Gemini-only workflow that supports multiple uploaded images, preserves a fast 2K/4K Quick Upscale lane, and adds a guided AI Studio path for analysis, per-image prompt generation, inline upscale execution, preview simulation, and Gemini-specific follow-through inside the same feature.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Multi-Image Session Foundation** - Build the self-contained Upscale shell, multi-image session model, and internal step flow
- [ ] **Phase 2: Quick Upscale Quality Lane** - Lock in the preservation-first quick path with 2K/4K options and comparison UX
- [ ] **Phase 3: AI Studio Analysis And Prompt Package** - Add Gemini-driven structured analysis and per-image prompt generation
- [ ] **Phase 4: AI Studio Inline Upscale Preview Guidance And Reliability** - Complete inline prompt-based upscale, preview simulation, Gemini guidance, and unsupported-model resilience

## Phase Details

### Phase 1: Multi-Image Session Foundation
**Goal**: Users can manage a Gemini-only multi-image Upscale session fully inside the Upscale feature without leaving the screen.
**Depends on**: Nothing (first phase)
**Requirements**: [UPS-01, UPS-03, UPS-04, UPS-05]
**Success Criteria** (what must be TRUE):
  1. User can upload and keep multiple images available in one Upscale session.
  2. User can select any uploaded image as the active image for the current step.
  3. User can move through the guided AI Studio steps without leaving the Upscale screen.
  4. User can switch between Quick Upscale and AI Studio within the same feature session.
**Plans**: 1 plan

Plans:
- [x] 01-01: Build Upscale session state, multi-image selection, and internal step shell

### Phase 2: Quick Upscale Quality Lane
**Goal**: Users can run a one-click 2K or 4K upscale flow with the locked preservation-first prompt pattern and review the result against the original.
**Depends on**: Phase 1
**Requirements**: [UPS-02, UPS-06]
**Success Criteria** (what must be TRUE):
  1. User can trigger Quick Upscale on the active session image from inside Upscale.
  2. User can choose 2K or 4K before running Quick Upscale.
  3. Quick Upscale always uses the locked preservation-first prompt pattern adapted to the selected quality.
  4. User can compare the original and result inside the same Upscale session.
**Plans**: 1 plan

Plans:
- [x] 02-01: Implement the 2K/4K Quick Upscale lane and comparison behavior

### Phase 3: AI Studio Analysis And Prompt Package
**Goal**: Users can generate a structured Gemini report with fashion analysis and a per-image prompt package for the active image.
**Depends on**: Phase 2
**Requirements**: [ANL-01, ANL-02, PRM-01, PRM-02, PRM-03]
**Success Criteria** (what must be TRUE):
  1. User can generate a structured analysis covering garments, materials, background, lighting, framing, and pose.
  2. User can see preservation-risk notes for sensitive details before continuing.
  3. User can receive a copy-ready English master prompt for the Gemini workflow.
  4. User can see prompt guidance that prioritizes faithful upscale and preservation over creative restyling.
  5. Each uploaded image keeps its own generated prompt for later inline upscale execution.
**Plans**: 1 plan

Plans:
- [x] 03-01: Implement Gemini analysis service, report schema, and per-image prompt package output

### Phase 4: AI Studio Inline Upscale Preview Guidance And Reliability
**Goal**: Users can finish the guided AI Studio lane with inline prompt-based upscale, preview simulation, Gemini-specific next steps, and clear unsupported-provider handling.
**Depends on**: Phase 3
**Requirements**: [UPS-07, PRV-01, PRV-02, GDE-01, GDE-02, REL-01]
**Success Criteria** (what must be TRUE):
  1. User can trigger Upscale immediately after AI Studio generates the prompt for the active image.
  2. User can read a simulated textual preview of likely upscale improvements.
  3. User can clearly distinguish simulated preview text from guaranteed output.
  4. User can view Gemini-specific execution guidance and a recommended next action for the active image.
  5. User sees clear feature-scoped errors when AI Studio is not supported by the current model or provider.
**Plans**: 1 plan

Plans:
- [x] 04-01: Add AI Studio inline upscale, preview, Gemini guidance, and reliability handling

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Multi-Image Session Foundation | 1/1 | ✅ Done | 2026-03-16 |
| 2. Quick Upscale Quality Lane | 1/1 | ✅ Done | 2026-03-16 |
| 3. AI Studio Analysis And Prompt Package | 1/1 | ✅ Done | 2026-03-16 |
| 4. AI Studio Inline Upscale Preview Guidance And Reliability | 1/1 | ✅ Done | 2026-03-16 |
