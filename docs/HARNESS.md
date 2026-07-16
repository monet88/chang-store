# Harness

The project goal is to provide a reusable operating harness that lets humans and
agents turn product intent and change requests into safe, validated work.

The app is what users touch. The harness is what agents touch.

## Mental Model

```text
------------------+
| Human intent    |
+------------------+
         |
         v
+------------------+
| Feature intake   |
+------------------+
         |
         v
+------------------+
| Story packet     |
+------------------+
         |
         v
+------------------+
| Agent work loop  |
+------------------+
         |
         v
+------------------+
| Product delta    |
+------------------+
         |
         v
+------------------+
| Validation proof |
+------------------+
         |
         v
+------------------+
| Harness delta    |
+------------------+
         |
         v
+------------------+
| Next intent      |
+------------------+
```

Every task has two possible outputs:

1. Product delta: app code, tests, API shape, data model, or product docs.
2. Harness delta: docs, templates, validation expectations, backlog items, or
   decision records that make the next task easier.

## Harness v0 Scope

Harness v0 includes:

- Agent entrypoint.
- Brownfield product documentation structure under `docs/product/`.
- Feature intake and risk lanes.
- Story templates.
- Decision log template.
- Validation report template.
- Test matrix placeholder.
- Harness growth backlog.
- Durable layer: SQLite database and CLI for operational records.

Harness v0 deliberately excludes:

- A project-specific `SPEC.md`.
- Pre-sliced product domains.
- A locked application stack.
- App source scaffolding for new products.
- Replacing project-owned package scripts, test runner config, or CI workflows.

Those are owned by the application and should only change when a selected story needs them.

## Durable Layer

Policy documents describe how to work. The durable layer stores what happened.

Operational data — intake classifications, story status, decision outcomes,
backlog items, and execution traces — lives in a SQLite database (`harness.db`)
managed by the Rust Harness CLI. On Windows, always use the native executable
directly: `& '.\scripts\bin\harness-cli.exe' <command>`; this is the repo's
`harness.exe` entrypoint. Do not use the `scripts/harness` wrapper on Windows.
On Git Bash/Linux, use the POSIX launcher `scripts/harness`. The underlying
prebuilt binaries are gitignored. The database is local to each project
instance and `.gitignore`d. The schema is version-controlled under
`scripts/schema/`.

All command examples below use the POSIX launcher for portability. When running
them in Windows PowerShell, replace `scripts/harness` with:

```powershell
& '.\scripts\bin\harness-cli.exe'
```

This separation keeps policy docs stable and human-readable while giving agents
a structured, queryable record of operational state. It also prepares the
harness for future observability and automated evolution without adding more
markdown files.

Initialize the database if it does not exist:

```bash
scripts/harness init
```

Common commands:

```bash
scripts/harness intake  --type <type> --summary <text> --lane <lane>
scripts/harness story   add --id <id> --title <text> --lane <lane>
scripts/harness story   update --id <id> --status <status>
scripts/harness trace   --summary <text> --outcome <outcome>
scripts/harness query   matrix
scripts/harness query   backlog
scripts/harness query   stats
```

## Source Hierarchy

```text
User-provided spec or prompt
  input material for first buildout or future changes

docs/product/*
  current product contract derived from accepted input

docs/stories/*
  story-sized work packets and historical evidence

scripts/harness query matrix
  behavior-to-proof control panel backed by the durable layer

docs/decisions/*
  why the contract changed
```

Before implementation, product docs describe intent. After implementation,
product docs plus executable tests become the living contract.

## Spec Lifecycle

Harness v0 can start from a new spec or from an existing codebase. In this
brownfield repo, accepted product behavior is captured in `docs/product/*`,
story packets, architecture decisions, and validation expectations.

After the specification has been decomposed, do not keep extending it as the
living product plan. Ongoing work should update the smaller product docs,
stories, durable proof records, and decision records.

Ongoing work should enter the harness as one of these input types:

- New spec: a project specification that needs to become product docs and
  initial story candidates.
- Spec slice: a selected behavior from the provided spec.
- Change request: a bounded behavior change, bug fix, or product refinement.
- New initiative: a larger product area that needs multiple stories.
- Maintenance request: dependency, architecture, performance, security, or
  operational work.
- Harness improvement: a process, template, proof, or agent-instruction change.

The spec-to-work loop is:

```text
human intent or supplied spec
  -> classify input type
  -> update or create product contract
  -> create story packet or initiative notes when needed
  -> define validation proof
  -> implement or document the blocker
  -> update product docs, stories, durable proof records, and decisions
  -> capture harness friction
```

Large product areas should use scoped initiative notes instead of a second
monolithic specification. An initiative should explain the goal, affected
product docs, candidate stories, validation shape, open decisions, and exit
criteria. If initiative work becomes a repeated pattern, add a template or
record the proposal with `scripts/harness backlog add`.

## Growth Rule

The harness grows from friction.

When an agent is confused, repeats manual reasoning, needs a new validation
command, discovers a missing rule, or sees a recurring failure pattern, it must
either improve the harness directly or record the friction:

```bash
scripts/harness backlog add --title "<short name>" --pain "<what was hard>"
```

The `harness_friction` field on traces also captures per-task friction so
patterns can be queried later:

```bash
scripts/harness query friction
```

## Task Loop

For every task:

1. Classify the request with `docs/FEATURE_INTAKE.md`.
2. Record the classification with `scripts/harness intake`.
3. Locate the affected product docs and story files.
4. Check proof status with `scripts/harness query matrix`.
5. Work only inside the selected lane: tiny, normal, or high-risk.
6. Before finishing, ask whether product truth, validation expectations,
   architecture rules, repeated failure patterns, or next-agent instructions
   changed.
7. Record a trace with `scripts/harness trace`, using
   `docs/TRACE_SPEC.md` for the expected trace tier and field depth.
8. If harness friction was found, either fix it directly or record it with
   `scripts/harness backlog add`.

## Harness Change Policy

Agents may update directly:

- Story status and evidence via `scripts/harness story update`.
- Test matrix rows via `scripts/harness story add` and
  `scripts/harness story update`.
- Links from story packets to product docs.
- Validation notes and reports.
- Small clarifications tied to the current task.
- Intake records, traces, and backlog items via `scripts/harness`.

Agents should ask for human confirmation before:

- Changing architecture direction.
- Removing validation requirements.
- Changing the source-of-truth hierarchy.
- Changing risk classification rules.
- Replacing the feature workflow.

## Done Definition

A task is done only when:

- The requested change is completed or the blocker is documented.
- Relevant docs, stories, and test matrix entries remain current.
- Validation commands were run when they exist.
- A trace has been recorded with `scripts/harness trace`.
- Missing harness capabilities were recorded with
  `scripts/harness backlog add`.
- The final response says what changed and what was not attempted.

## Validation Ladder

Current app quality gates are npm/Vite commands plus Harness proof queries:

```text
quick docs check
  grep stale claims, review touched docs, run git diff --check

app quality gate
  npx tsc --noEmit
  npm run lint
  npm run test
  npm run build

story proof check
  scripts/harness query matrix
  scripts/harness story update --id <id> --status <status> --evidence <text>

browser/provider smoke
  npm run dev
  Playwright or scripts/provider-tryon-smoke.ts when image-provider behavior changes
```

Agents must not claim a command passes until it exists and has been run in this repo.
