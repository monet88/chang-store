# Documentation Map

Project documentation for chang-store, an AI-powered virtual fashion studio.

## Harness and operating rules

- HARNESS.md: how humans and agents collaborate.
- FEATURE_INTAKE.md: how prompts become tiny, normal, or high-risk work.
- CONTEXT_RULES.md: phase-by-lane context engineering rules.
- TRACE_SPEC.md: execution trace fields, quality tiers, and friction capture.
- HARNESS_COMPONENTS.md: responsibility map and current repository inventory.
- HARNESS_MATURITY.md: maturity ladder and current assessment.
- HARNESS_BACKLOG.md: missing Harness capabilities and follow-up proposals.
- TEST_MATRIX.md: human-readable proof map; durable status comes from SQLite.
- GLOSSARY.md: shared terms.
- contracts/: versioned machine-readable contracts for external orchestrators.

On Windows, run Harness with the native executable:

~~~powershell
& '.\\scripts\\bin\\harness-cli.exe' <command>
~~~

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
