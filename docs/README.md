# Documentation Map

Project documentation for chang-store — an AI-powered virtual fashion studio.

## Harness (Operating Rules)

- `HARNESS.md`: how humans and agents collaborate.
- `FEATURE_INTAKE.md`: how prompts become tiny, normal, or high-risk work.
- `CONTEXT_RULES.md`: phase-by-lane context engineering rules.
- `TRACE_SPEC.md`: execution trace fields, quality tiers, friction capture.
- `HARNESS_COMPONENTS.md`: responsibility map and file inventory.
- `HARNESS_MATURITY.md`: H0-H5 maturity ladder and current assessment.
- `HARNESS_BACKLOG.md`: legacy improvement list (use `scripts/harness backlog`).
- `TEST_MATRIX.md`: legacy proof map (use `scripts/harness query matrix`).
- `GLOSSARY.md`: shared terms.

## Project-Specific

- `ARCHITECTURE.md`: actual app architecture — layers, routing, providers.
- `system-architecture.md`: legacy/living architecture entrypoint linked to `ARCHITECTURE.md`.
- `code-standards.md`: naming, patterns, quality gates, prohibited patterns.
- `codebase-summary.md`: source layout, feature enum, persistence, validation.
- `project-overview-pdr.md`: product requirements and non-functional requirements.
- `project-roadmap.md`: completed, current, and future roadmap phases.
- `deployment-guide.md`: Vite/static hosting and environment variable setup.
- `design-guidelines.md`: Runway-inspired visual and responsive guidelines.
- `CHANGELOG.md`: current documentation changes and historical summary.
- `api/README.md`: current API reference policy and source-of-truth links.

## Product Docs (`product/`)

Feature behavior contracts derived from the codebase:

- `overview.md`: product summary, tech stack, feature list.
- `provider-studios.md`: three-provider studio split (Gemini/Grok/GPT Image).
- `try-on.md`: Virtual Try-On + Wardrobe Mode.
- `lookbook.md`: Lookbook Generator.
- `background.md`: Background Replacer.
- `pose.md`: Pose Changer.
- `photo-album.md`: Photo Album Creator.
- `ai-editor.md`: AI Editor with @mention system.
- `watermark-remover.md`: Batch Watermark Remover.
- `clothing-transfer.md`: Clothing Transfer.
- `pattern-generator.md`: Pattern Generator.

## Folders

- `product/`: current product truth per feature.
- `stories/`: feature packets and backlog.
- `decisions/`: durable decisions and tradeoffs (ADRs).
- `templates/`: reusable story, decision, validation, and spec-intake formats.

## Current State

Harness v0 is installed. Application code exists and is deployed. Product docs
reflect the current Feature enum and codebase behavior, including the
three-provider studio split, as of the 2026-05-31 docs resync (story US-002).
Known dead code (`useSwapFace`, `useInpainting`) is tracked in Harness backlog
item #2.
