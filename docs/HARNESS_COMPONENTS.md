# Harness Components

This taxonomy maps the **chang-store** repository to two component frameworks:

- Runtime Substrate responsibilities: the 11 responsibility areas the harness
  should cover.
- NexAU decomposition: the seven implementation surfaces that influence agent
  behavior.

Scope note: chang-store consumes Harness as an installed payload. The Harness
CLI ships here as a tracked prebuilt Windows binary at
`scripts/bin/harness-cli.exe` and a local POSIX binary at
`scripts/bin/harness-cli`; on Windows the `.exe` is the required direct
`harness.exe` entrypoint.
the Rust source (`crates/`, `Cargo.*`) and the installer/release scripts live in
the upstream Harness repo, not here. This inventory lists only files tracked in
**this** repository (`git ls-files`).

Status values:

- **Covered**: the repository has an explicit file, command, or record for this
  responsibility.
- **Partial**: the repository has some support, but the support is incomplete,
  manual, or not yet measured.
- **Missing**: no meaningful support exists yet.

## Responsibility Map

| # | Responsibility | Status | Harness Files | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| 1 | Task specification | Covered | `AGENTS.md`, `docs/FEATURE_INTAKE.md`, `docs/templates/story.md`, `docs/templates/spec-intake.md`, `docs/templates/high-risk-story/*`, `docs/stories/*`, `intake` table, `story` table | Requests are classified by type and lane before implementation; normal and high-risk work have templates and durable story rows. | Keep story packets synchronized with future product docs. |
| 2 | Context selection | Covered | `AGENTS.md`, `docs/CONTEXT_RULES.md`, `docs/ARCHITECTURE.md`, `docs/decisions/*`, `docs/product/README.md` | Phase 2 adds phase-by-lane context rules and retrieval triggers while preserving the stable entry list in `AGENTS.md`. | Future automation could enforce context selection or measure over-reading. |
| 3 | Tool access | Partial | `scripts/harness`, `scripts/bin/harness-cli.exe` (tracked Windows binary), `scripts/bin/harness-cli` (local POSIX binary), `scripts/README.md`, `scripts/schema/001-init.sql` | The Harness CLI exposes operational commands for intake, stories, decisions, backlog, traces, and queries; Windows uses the `.exe` directly. Rust source and installer scripts are upstream-only. | No machine-readable tool registry, permission profile, or capability manifest exists yet. |
| 4 | Project memory | Covered | `docs/HARNESS.md`, `docs/decisions/*`, `docs/GLOSSARY.md`, `docs/HARNESS_BACKLOG.md`, `docs/stories/*`, `harness.db`, `decision`, `backlog`, and `trace` tables | Decisions, backlog, stories, and traces preserve durable knowledge across tasks. | Future work should add staleness checks and summarize old traces. |
| 5 | Task state | Covered | `scripts/harness query matrix`, `docs/TEST_MATRIX.md`, `intake` table, `story` table, `trace` table | Durable records track intake, story status, proof columns, and task traces. | Add lifecycle checks so in-progress stories cannot be forgotten. |
| 6 | Observability | Partial | `docs/TRACE_SPEC.md`, `trace` table, `scripts/harness query traces`, `scripts/harness query friction`, `docs/HARNESS_MATURITY.md` | Traces can be recorded and Phase 2 defines quality tiers and maturity targets. | No automated trace quality scoring, dashboard, or benchmark ingestion exists in this repo. |
| 7 | Failure attribution | Partial | `docs/HARNESS_COMPONENTS.md`, `docs/TRACE_SPEC.md`, `trace.errors`, `trace.harness_friction`, `docs/HARNESS_BACKLOG.md`, `backlog` table | Failures can be tied to files, components, friction, and backlog proposals. | No automated attribution from benchmark failures to harness components exists yet. |
| 8 | Verification | Partial | `docs/TEST_MATRIX.md`, `scripts/harness query matrix`, `story` proof columns, `.github/workflows/ci.yml`, `docs/templates/validation-report.md` | Stories record unit, integration, E2E, and platform proof; CI runs the app quality gates. | No generic verification runner, benchmark protocol file, or required final proof automation exists in this repo. |
| 9 | Permissions | Partial | `AGENTS.md`, `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md` | Policy describes when agents may update docs and when to ask before architecture or workflow changes. | Permissions are instruction-level only; no enforced policy layer or command allowlist exists. |
| 10 | Entropy auditing | Partial | `docs/HARNESS_BACKLOG.md`, `backlog` table, `trace.harness_friction`, `docs/HARNESS_MATURITY.md` | Growth rule captures friction and Phase 2 defines maturity movement. | No drift detector, stale-doc audit, or entropy score exists. |
| 11 | Intervention recording | Partial | `trace` table, `docs/decisions/*`, `docs/stories/*`, `docs/HARNESS.md` | Traces and decisions can record actions, decisions, and outcomes. | Human interventions are not separated from normal agent actions, and there is no review-event schema. |

## NexAU Cross-Reference

| Component | Harness Equivalent | Status | Notes |
| --- | --- | --- | --- |
| System prompts | `AGENTS.md` plus Harness policy docs | Covered | `AGENTS.md` is the stable shim; `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, and `docs/CONTEXT_RULES.md` carry evolving operating instructions. |
| Tool descriptions | `scripts/README.md`, `docs/HARNESS.md`, CLI help from the platform-native Harness executable | Partial | Commands are documented, but there is no standalone tool schema or generated command reference. |
| Tool implementations | `scripts/harness`, `scripts/bin/harness-cli.exe`, `scripts/bin/harness-cli`, `scripts/schema/001-init.sql` | Covered | The prebuilt Rust CLI is the durable-layer implementation; Windows invokes `harness-cli.exe` directly and POSIX uses the launcher. Its source is upstream. |
| Middleware | platform-native Harness executable, feature intake workflow | Partial | The launcher/executable and intake process mediate work, but there is no runtime middleware enforcing policies. |
| Skills | `docs/templates/*`, `docs/FEATURE_INTAKE.md`, `docs/CONTEXT_RULES.md`, `docs/TRACE_SPEC.md` | Partial | Reusable procedures exist as markdown, not executable or installable agent skills. |
| Sub-agents | None in this repository | Missing | No delegated specialist agents or sub-agent protocols exist. |
| Long-term memory | `harness.db`, `docs/decisions/*`, `docs/stories/*`, `docs/HARNESS_BACKLOG.md`, `docs/GLOSSARY.md` | Covered | Durable records and markdown decisions preserve task history and project vocabulary. |

## File Inventory

This inventory maps the Harness/operating surface tracked in **this** repository
(root agent files, `docs/`, `scripts/`, `.github/`). It does
not enumerate application source under `src/` — that surface is documented in
`docs/codebase-summary.md`, `docs/ARCHITECTURE.md`, and `docs/product/*`. Every
row below references a file that exists in the repo (`git ls-files`).

### Root agent + project files

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `AGENTS.md` | Context selection | Task specification, permissions |
| `README.md` | Task specification | Project memory |
| `CLAUDE.md` | Context selection | Task specification |
| `PRODUCT.md` | Task specification | Project memory |
| `DESIGN.md` | Task specification | Project memory |

### Harness operating docs

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `docs/HARNESS.md` | Task specification | Project memory, task state, permissions |
| `docs/FEATURE_INTAKE.md` | Task specification | Permissions, context selection |
| `docs/CONTEXT_RULES.md` | Context selection | Permissions, task specification |
| `docs/TRACE_SPEC.md` | Observability | Failure attribution, intervention recording |
| `docs/HARNESS_BACKLOG.md` | Entropy auditing | Project memory, failure attribution |
| `docs/HARNESS_COMPONENTS.md` | Failure attribution | Observability, entropy auditing |
| `docs/HARNESS_MATURITY.md` | Entropy auditing | Observability, verification |
| `docs/TEST_MATRIX.md` | Verification | Task state |
| `docs/GLOSSARY.md` | Project memory | Context selection |
| `docs/README.md` | Project memory | Context selection |

### Project docs

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | Permissions | Context selection, task specification |
| `docs/system-architecture.md` | Context selection | Task specification |
| `docs/code-standards.md` | Permissions | Verification |
| `docs/codebase-summary.md` | Context selection | Project memory |
| `docs/project-overview-pdr.md` | Task specification | Project memory |
| `docs/project-roadmap.md` | Project memory | Task state |
| `docs/deployment-guide.md` | Verification | Context selection |
| `docs/design-guidelines.md` | Task specification | Context selection |
| `docs/CHANGELOG.md` | Project memory | Intervention recording |
| `docs/product/*` | Task specification | Context selection, project memory |
| `docs/api/*` | Context selection | Task specification |

### Decisions

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `docs/decisions/0001-harness-first-development.md` | Project memory | Permissions |
| `docs/decisions/0002-post-spec-product-lifecycle.md` | Project memory | Task specification |
| `docs/decisions/0003-generic-spec-intake-harness.md` | Project memory | Task specification |
| `docs/decisions/0004-sqlite-durable-layer.md` | Project memory | Observability, task state |
| `docs/decisions/0005-prebuilt-rust-harness-cli.md` | Project memory | Tool access |
| `docs/decisions/README.md` | Project memory | Context selection |

### Stories + templates

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `docs/stories/README.md` | Task specification | Project memory |
| `docs/stories/backlog.md` | Task specification | Project memory |
| `docs/stories/epics/E01-provider-studios/US-001-three-provider-studios/*` | Task specification | Verification, intervention recording |
| `docs/stories/epics/E02-docs-harness-sync/US-002-docs-backfill-resync.md` | Task specification | Entropy auditing, intervention recording |
| `docs/templates/story.md` | Task specification | Verification |
| `docs/templates/decision.md` | Project memory | Task specification |
| `docs/templates/spec-intake.md` | Task specification | Context selection |
| `docs/templates/validation-report.md` | Verification | Intervention recording |
| `docs/templates/high-risk-story/overview.md` | Task specification | Context selection |
| `docs/templates/high-risk-story/design.md` | Task specification | Permissions |
| `docs/templates/high-risk-story/execplan.md` | Task state | Verification |
| `docs/templates/high-risk-story/validation.md` | Verification | Failure attribution |

### Scripts + CI

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `scripts/harness` | Tool access | Task state, observability |
| `scripts/bin/harness-cli.exe` (Windows, tracked prebuilt binary) | Tool access | Task state, observability |
| `scripts/bin/harness-cli` (POSIX, local prebuilt binary) | Tool access | Task state, observability |
| `scripts/schema/001-init.sql` | Task state | Observability, project memory |
| `scripts/README.md` | Tool access | Context selection |
| `scripts/provider-tryon-smoke.ts` | Verification | Tool access |
| `harness.db` (gitignored) | Task state | Observability, project memory |
| `.github/workflows/ci.yml` | Verification | Tool access |
| `.github/copilot-instructions.md` | Context selection | Task specification |

## Coverage Summary

- Covered: 4/11 responsibilities.
- Partial: 7/11 responsibilities.
- Missing: 0/11 responsibilities.

Covered responsibilities:

- Task specification.
- Context selection.
- Project memory.
- Task state.

Partial responsibilities:

- Tool access.
- Observability.
- Failure attribution.
- Verification.
- Permissions.
- Entropy auditing.
- Intervention recording.

In chang-store, context selection is explicit (`docs/CONTEXT_RULES.md`) and
observability has a trace specification (`docs/TRACE_SPEC.md`). The partial
areas remain instruction-level; later work should convert them into measurable
checks (automated trace scoring, a generic verification runner, and a stale-doc
drift detector — the gap this US-002 resync exposed).
