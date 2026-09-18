# 0009 Removal of Grok and Dedicated Cloned Studio for GPT

Date: 2026-09-18

## Status

Accepted

## Context

The application previously maintained three studio modes (`gemini`, `grok`, `gptImage`). `grok` and `gptImage` shared a generic wizard-style layout (`ProviderStudioShell` / `ProviderStudioController`) supporting only 5 out of 10 features.
Live evaluation and user requirements established:
1. Grok (xAI) is no longer needed in the product and introduces dead weight/maintenance overhead.
2. The GPT Image engine must offer the full suite of 10 fashion features rather than being constrained to a generic 5-feature wizard.
3. Merging Gemini and GPT into a single polymorphic component created excessive branch complexity and leaky abstractions around divergent controls (e.g. Gemini aspect ratios vs. GPT pixel sizes and qualities).
4. Gemini remains the exclusive model for text/vision intelligence (prompt enrichment, scene analysis, clothing parsing), while GPT Image handles image generation/editing tasks.

## Decision

1. **Complete Removal of Grok**: Delete all Grok-specific services (`grokImageService.ts`), registries (`grokModelRegistry.ts`), components (`GrokStudio.tsx`), test files, and driver configurations (`grok-images`).
2. **Dedicated Cloned Studio for GPT (`GptStudio`)**: Provide a dedicated studio layout for GPT mirroring the 10 features of Gemini Studio, customized specifically for GPT Image capabilities (pixel sizes, image qualities, and OpenAI multipart edit contracts).
3. **Hybrid Architecture**: All prompt synthesis and multimodal image analysis across both studios utilize the Google Gemini text pipeline. When operating in GPT Studio, image creation/editing requests route to the `openai-images` driver via configured Image Gateway profiles.
4. **Unified Gallery Integration**: Images generated in GPT Studio automatically persist to the central IndexedDB gallery alongside Gemini images.
5. **Cleaned Settings Interface**: Simplify Settings to two clean sections: Google Gemini (CPA Gateway) and OpenAI / GPT Image Gateway.

## Alternatives Considered

- **Single Polymorphic Interface**: Unifying all 10 features into identical component instances with conditional branches. Rejected due to tight coupling and leaky abstractions between Gemini-specific resolution logic and GPT-specific pixel dimension requirements.
- **Retaining Grok in a disabled state**: Rejected to adhere to clean cutover and avoid dead code debt.

## Consequences

Positive:
- Full feature parity (10/10 features) for both Gemini and GPT engines.
- Clean codebase free of dead Grok code and generic wizard layers.
- Seamless user experience switching between Gemini and GPT with familiar workflows.

Tradeoffs:
- Duplicate UI structures between Gemini components and GPT components, requiring intentional maintenance when layout styles change.
