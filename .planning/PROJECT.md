# Chang-Store

## What This Is

Chang-Store is a browser-based AI fashion studio for creators and fashion teams who need to generate, edit, refine, and compare lookbook-style imagery without leaving the web app. It already supports multiple fashion workflows such as virtual try-on, background replacement, clothing transfer, lookbook generation, and direct image upscaling across Gemini and custom provider backends.

## Core Value

Users can turn fashion reference images into production-ready visual assets quickly, with predictable quality and minimal manual tool-hopping.

## Current Milestone: v1.0 Improve Upscale Feature

**Goal:** Turn Upscale into a self-contained hybrid workflow that keeps direct in-app upscaling while adding a step-based Gemini-only AI Studio pipeline that can generate per-image prompts and trigger upscale immediately inside the same feature.

**Target features:**
- Structured image analysis for one or more uploaded fashion lookbook photos
- English prompt generation tuned for the Gemini workflow already used in the app
- Simulated "what the upscale will look like" preview description
- Actionable execution guidance for Gemini only
- Entire pipeline contained inside the Upscale feature without depending on other feature screens
- Support for handling multiple uploaded images inside the same Upscale session
- A preservation-first `Quick Upscale` lane with 2K and 4K quality options
- A per-image AI Studio prompt output with an inline Upscale action for that image

## Requirements

### Validated

- [x] Users can switch between multiple AI fashion image workflows inside one SPA
- [x] Users can route image operations through Gemini, local, and anti providers from shared settings
- [x] Users can upload a single image to Upscale, choose quality, and generate an upscaled result
- [x] Users can compare original and upscaled images inside the Upscale screen
- [x] Users can use bilingual UI strings through the shared language context

### Active

- [ ] User can upload multiple lookbook images and receive a structured AI Studio report for the selected image inside Upscale
- [ ] User can keep using direct in-app upscale in the same feature flow without losing the simple path
- [ ] User can copy or reuse a generated English prompt tailored for the Gemini workflow already available in the app
- [ ] User can read a simulated high-resolution outcome description before choosing the next action
- [ ] User can see Gemini-specific follow-up instructions without depending on third-party tools
- [ ] User can complete the full guided pipeline inside Upscale without switching to another feature
- [ ] User can run `Quick Upscale` with a preservation-first prompt pattern that adapts to 2K or 4K output
- [ ] User can trigger Upscale immediately after AI Studio generates the prompt for a selected image

### Out of Scope

- Any Midjourney, Krea, Leonardo, Topaz, Make.com, or Zapier support in this milestone — user clarified this milestone should stay Gemini-only
- Reusing or spreading the pipeline across other feature screens — user clarified the whole experience must stay inside Upscale
- Reworking unrelated feature screens outside Upscale — keep milestone tightly scoped
- Moving provider calls behind a backend proxy — important architectural concern, but not part of this milestone

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
| Keep the milestone Gemini-only | User explicitly narrowed the feature after research review, so roadmap and requirements should ignore third-party tool paths | ✓ Good |
| Use a preservation-first Quick Upscale prompt template with 2K and 4K options | User first provided the prompt style, then clarified that 2K must be added back, so Quick Upscale should keep quality selection while preserving the same prompt intent | ✓ Good |
| AI Studio should allow inline upscale right after prompt generation | User wants prompt generation to lead directly into execution for each image inside the same feature | ✓ Good |

### Quick Upscale Prompt Pattern

```text
Upscale this image to {target_resolution} resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model's face and the overall composition exactly the same. Photorealistic, fashion photography quality, {output_quality}.
```

**4K variant provided by user:**

```text
Upscale this image to 4K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model's face and the overall composition exactly the same. Photorealistic, fashion photography quality, 8K quality.
```

---
*Last updated: 2026-03-16 after milestone v1.0 kickoff*
