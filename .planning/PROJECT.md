# Chang-Store

## What This Is

Chang-Store is a browser-based AI fashion studio for creators and fashion teams who need to generate, edit, refine, and compare lookbook-style imagery without leaving the web app. It already supports multiple fashion workflows such as virtual try-on, background replacement, clothing transfer, lookbook generation, and direct image upscaling across Gemini and custom provider backends.

## Core Value

Users can turn fashion reference images into production-ready visual assets quickly, with predictable quality and minimal manual tool-hopping.

## Current Milestone: v1.0 Improve Upscale Feature

**Goal:** Turn Upscale into a hybrid workflow that keeps direct in-app upscaling while adding AI-guided analysis, prompt generation, simulated upscale preview, and practical follow-through guidance.

**Target features:**
- Structured image analysis for uploaded fashion lookbook photos
- English prompt generation tuned for external image/upscale workflows
- Simulated "what the upscale will look like" preview description
- Actionable execution guidance for Gemini, Midjourney, Krea, Leonardo, Topaz, and no-code automation

## Requirements

### Validated

- [x] Users can switch between multiple AI fashion image workflows inside one SPA
- [x] Users can route image operations through Gemini, local, and anti providers from shared settings
- [x] Users can upload a single image to Upscale, choose quality, and generate an upscaled result
- [x] Users can compare original and upscaled images inside the Upscale screen
- [x] Users can use bilingual UI strings through the shared language context

### Active

- [ ] User can upload a lookbook image and receive a structured AI Studio report inside Upscale
- [ ] User can keep using direct in-app upscale in the same feature flow without losing the simple path
- [ ] User can copy or reuse a generated English prompt tailored for high-end fashion image workflows
- [ ] User can read a simulated high-resolution outcome description before choosing the next action
- [ ] User can see tool-specific follow-up instructions for external platforms and automation flows

### Out of Scope

- End-to-end integration with Midjourney, Krea, Leonardo, Topaz, Make.com, or Zapier APIs in this milestone — this milestone provides guidance output, not third-party execution
- Reworking unrelated feature screens outside Upscale — keep milestone tightly scoped
- Moving provider calls behind a backend proxy — important architectural concern, but not part of this milestone
- Batch upscale pipelines for multiple uploaded images — not part of the requested workflow yet

## Context

- The app is a React 19 + TypeScript + Vite browser SPA with provider routing centralized in `services/imageEditingService.ts`.
- Current Upscale is implemented as a single component and only supports direct upload -> quality select -> upscale -> compare.
- The desired milestone expands Upscale from a pure utility into a guided "AI Studio" workflow for fashion lookbook images.
- Existing repo conventions prefer thin components, hooks for orchestration, service facades for provider logic, and localized UI strings in both English and Vietnamese.

## Constraints

- **Tech stack**: Keep implementation inside the existing React SPA architecture — avoid introducing a backend for this milestone
- **Compatibility**: Preserve current direct-upscale behavior so existing users do not lose the fast path
- **Architecture**: Provider routing stays in services and shared context, not duplicated in the UI
- **Localization**: New user-facing strings must be added to both `locales/en.ts` and `locales/vi.ts`
- **Scope control**: Focus milestone on Upscale only, not broad documentation or provider refactors

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use a hybrid Upscale experience instead of replacing the current flow | Preserve current quick upscale utility while adding higher-value AI Studio guidance | — Pending |
| Treat this as milestone v1.0 in GSD planning | Repo had no prior GSD milestone history, so first tracked milestone should start cleanly | ✓ Good |
| Run research before requirements | External-tool guidance and AI-studio UX benefit from pattern and pitfall research | — Pending |

---
*Last updated: 2026-03-16 after milestone v1.0 kickoff*
