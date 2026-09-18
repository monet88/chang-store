# Documentation Map

Project documentation for chang-store, an AI-powered virtual fashion studio.

## Project documentation

- ARCHITECTURE.md: Harness boundaries plus the current Chang Store app architecture.
- system-architecture.md: living application architecture entrypoint.
- code-standards.md: naming, patterns, quality gates, and prohibited patterns.
- codebase-summary.md: source layout, feature enum, persistence, and proof notes.
- project-overview-pdr.md: product requirements and non-functional requirements.
- project-roadmap.md: completed, current, and future roadmap phases.
- deployment-guide.md: Vite/static hosting and environment setup.
- dev/windows-linux-node-modules.md: dual-boot dependency guidance.
- design-guidelines.md: Runway-inspired visual and responsive guidelines.
- CHANGELOG.md: dated product and documentation history.
- api/README.md: API reference policy and source-of-truth links.

## Product docs

Feature behavior contracts derived from the current source:

- product/overview.md
- product/provider-studios.md
- product/identity-transfer.md
- product/try-on.md
- product/lookbook.md
- product/background.md
- product/pose.md
- product/photo-album.md
- product/ai-editor.md
- product/watermark-remover.md
- product/clothing-transfer.md
- product/pattern-generator.md

## Stories and decisions

- stories/: feature packets, bug packets, and the selected documentation-sync story.
- decisions/: durable architecture and Harness decisions.
- templates/: reusable story, decision, validation, and spec-intake formats.
- journals/: dated operational notes.

## Current state

The repository contains a React/Vite application and the installed Harness
workflow. The application docs were recovered from
.harness-backup/20260716162737 and are being reconciled against the current
source tree. The backfill is complete; dated live-E2E results in codebase-summary.md remain
historical evidence because the previous scripts/e2e-live/ runner is retired
from this checkout.
