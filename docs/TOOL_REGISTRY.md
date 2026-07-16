# Harness Command Registry

This document lists the commands provided by the checked-in Harness payload.
The Windows entrypoint is `scripts/bin/harness-cli.exe`, invoked directly from
PowerShell as the repo's `harness.exe` command. The POSIX launcher
`scripts/harness` is for Git Bash/Linux only.

CodeGraph is the repository's active code-intelligence source. It is provided
by the development environment and is not registered through Harness; use the
CodeGraph MCP tool or the `codegraph` CLI for semantic navigation and impact
analysis.

## Windows examples

```powershell
& '.\scripts\bin\harness-cli.exe' init
& '.\scripts\bin\harness-cli.exe' intake --type "Maintenance request" --summary "..." --lane normal
& '.\scripts\bin\harness-cli.exe' story add --id "OPS-SHORT-ID" --title "..." --lane normal --contract "..."
& '.\scripts\bin\harness-cli.exe' story update --id "OPS-SHORT-ID" --status implemented --unit 1 --integration 1 --e2e 1 --platform 1 --evidence "..."
& '.\scripts\bin\harness-cli.exe' trace --summary "..." --outcome completed
& '.\scripts\bin\harness-cli.exe' query matrix
```

## Compiled command manifest

| Command | Responsibility | Purpose |
| --- | --- | --- |
| `init` | Task state | Create the Harness database if it does not exist. |
| `migrate` | Task state | Apply schema migrations. |
| `import brownfield` | Project memory | Seed or refresh records from markdown state. |
| `intake` | Task specification | Record a feature-intake classification. |
| `story add` | Task state | Add a durable story. |
| `story update` | Task state | Update status, proof flags, and evidence. |
| `decision add` | Project memory | Add a durable decision record. |
| `decision verify` | Verification | Run a decision verification command. |
| `backlog add` | Entropy auditing | Record a process-improvement proposal. |
| `backlog close` | Entropy auditing | Close a backlog item with outcome evidence. |
| `trace` | Observability | Record an agent execution trace. |
| `score-trace` | Observability | Score trace detail against quality tiers. |
| `query matrix` | Task state | Show durable story proof status. |
| `query backlog` | Entropy auditing | Show backlog proposals. |
| `query decisions` | Project memory | Show decision records. |
| `query intakes` | Task specification | Show recent intake records. |
| `query traces` | Observability | Show recent traces. |
| `query friction` | Failure attribution | Show traces with recorded friction. |
| `query stats` | Task state | Show durable record counts. |
| `query sql` | Diagnostics | Run a read-only or explicitly authorized SQL query. |

The exact flags are versioned by the binary. Verify them with:

```powershell
& '.\scripts\bin\harness-cli.exe' --help
& '.\scripts\bin\harness-cli.exe' <command> --help
```

## Tool-selection policy

- Use CodeGraph first for code symbols, call paths, and blast-radius questions.
- Use the Harness executable for intake, durable stories, decisions, backlog,
  traces, and proof queries.
- Keep CodeGraph as the sole semantic code-intelligence source for this repo.
