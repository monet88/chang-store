# Chang-Store

## What This Is

Chang-Store is a browser-based AI fashion studio for creators and fashion teams who need to generate, edit, refine, and compare lookbook-style imagery without leaving the web app. It already supports multiple fashion workflows such as virtual try-on, background replacement, clothing transfer, lookbook generation, and direct image upscaling across Gemini and custom provider backends.

## Core Value

Users can turn fashion reference images into production-ready visual assets quickly, with predictable quality and minimal manual tool-hopping.

## Current Milestone: Planning Next Milestone

**Goal:** Define the next milestone after shipping v1.1 batch workflows for Virtual Try-On and Clothing Transfer.

**Target features:**
- (TBD - pending milestone definition)

## Requirements

### Validated

- ✓ Users can switch between multiple AI fashion image workflows inside one SPA — baseline
- ✓ Users can route image operations through Gemini, local, and anti providers from shared settings — baseline
- ✓ Users can upload a single image to Upscale, choose quality, and generate an upscaled result — baseline
- ✓ Users can compare original and upscaled images inside the Upscale screen — baseline
- ✓ Users can use bilingual UI strings through the shared language context — baseline
- ✓ User can upload multiple lookbook images and receive a structured AI Studio report for the selected image inside Upscale — v1.0
- ✓ User can keep using direct in-app upscale in the same feature flow without losing the simple path — v1.0
- ✓ User can copy or reuse a generated English prompt tailored for the Gemini workflow already available in the app — v1.0
- ✓ User can read a simulated high-resolution outcome description before choosing the next action — v1.0
- ✓ User can see Gemini-specific follow-up instructions without depending on third-party tools — v1.0
- ✓ User can complete the full guided pipeline inside Upscale without switching to another feature — v1.0
- ✓ User can run `Quick Upscale` with a preservation-first prompt pattern that adapts to 2K or 4K output — v1.0
- ✓ User can trigger Upscale immediately after AI Studio generates the prompt for a selected image — v1.0
- ✓ User can batch multiple subject images in Virtual Try-On with one shared outfit set — v1.1
- ✓ User can batch multiple concept images in Clothing Transfer with one shared reference outfit set — v1.1
- ✓ User can see per-item processing status and partial failures inside both batch features — v1.1
- ✓ User can keep the existing single-image path while using the new batch-capable feature screens — v1.1

### Active

- (None yet — define the next milestone before starting implementation)

### Out of Scope

- Backend job queues or export tooling for long-running batch image work — v1.1 stayed inside client-side orchestration
- Batch expansion across unrelated feature screens — shipped scope stayed limited to Virtual Try-On and Clothing Transfer
- Outfit/reference cross-product generation — current product requirement is one shared set applied to many source images
- Moving provider calls behind a backend proxy — still important, but not addressed yet

## Context

- The app is a React 19 + TypeScript + Vite browser SPA with provider routing centralized in `src/services/imageEditingService.ts`.
- Shipped v1.0 milestone, successfully upgrading Upscale into a multi-mode feature with Quick Upscale and an AI Studio pipeline running in parallel.
- Shipped v1.1 milestone, adding bounded-parallel batch orchestration to Virtual Try-On and Clothing Transfer with per-item result tracking.
- Shipped v1.2 milestone, consolidating all runtime source under `src/` — `@` alias now resolves to `src/` across TypeScript, Vite, and Vitest; all 23 test files updated; all docs and agent guidance synced.
- The workflow now supports multi-image sessions across Upscale, Virtual Try-On, and Clothing Transfer while preserving existing provider contracts.
- Virtual Try-On and Clothing Transfer now share the same batch-session remapping and worker-pool orchestration pattern.
- Existing repo conventions (thin components, hooks for orchestration, service facades for provider logic, bilingual localized UI strings) were followed throughout shipped milestones.

## Constraints

- **Tech stack**: Keep implementation inside the existing React SPA architecture unless a future milestone explicitly funds backend work
- **Compatibility**: Preserve current single-image flows while extending batch behaviors incrementally
- **Architecture**: Provider routing stays in services and shared context, not duplicated in the UI
- **Localization**: New user-facing strings must be added to both `locales/en.ts` and `locales/vi.ts`
- **Scope control**: Keep future milestones tightly scoped to a small number of feature surfaces at a time

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use a hybrid Upscale experience instead of replacing the current flow | Preserve current quick upscale utility while adding higher-value AI Studio guidance | ✓ Good |
| Treat this as milestone v1.0 in GSD planning | Repo had no prior GSD milestone history, so first tracked milestone should start cleanly | ✓ Good |
| Keep the milestone Gemini-only | User explicitly narrowed the feature after research review, so roadmap and requirements should ignore third-party tool paths | ✓ Good |
| Use a preservation-first Quick Upscale prompt template with 2K and 4K options | User first provided the prompt style, then clarified that 2K must be added back, so Quick Upscale should keep quality selection while preserving the same prompt intent | ✓ Good |
| AI Studio should allow inline upscale right after prompt generation | User wants prompt generation to lead directly into execution for each image inside the same feature | ✓ Good |
| Batch the subject/concept list only, not outfit/reference cross-products | User requirement was many inputs against one shared set, so cross-product generation would add wrong cost and wrong UX | ✓ Good |
| Keep batching in hooks, not services | Existing architecture already separates UI from orchestration and keeps service contracts provider-focused | ✓ Good |
| Cap shared outfit/reference inputs at 2 images | Product requirement is one compact shared set, so the UI should enforce the limit instead of allowing unsupported extra inputs | ✓ Good |
| Use a bounded worker pool for batch execution | Parallelism is needed for speed, but unbounded fan-out would create noisy provider load and less predictable UX | ✓ Good |

### Quick Upscale Prompt Pattern

```text
Upscale this image to {target_resolution} resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model's face and the overall composition exactly the same. Photorealistic, fashion photography quality, {output_quality}.
```

**4K variant provided by user:**

```text
Upscale this image to 4K resolution. Enhance the details, make the fabric textures look sharp and realistic, and ensure the colors are vibrant and accurate. Keep the model's face and the overall composition exactly the same. Photorealistic, fashion photography quality, 8K quality.
```

| One-pass cutover for src/ migration: no bridge files, remove root copies immediately | Clean break prevents dual-source confusion for both humans and AI agents | ✓ Good |

---
*Last updated: 2026-03-24 after v1.2 milestone*
