# Hướng Dẫn Sử Dụng Gastown

## Gastown Là Gì?

**Gastown** là công cụ điều phối multi-agent cho Claude Code - giúp quản lý và theo dõi công việc của nhiều AI agents làm việc song song trên nhiều dự án.

### Tại Sao Cần Gastown?

| Không có Gastown | Có Gastown |
|------------------|------------|
| Agent quên việc sau khi restart | Công việc persistent, sống sót qua crashes/restarts |
| Phối hợp thủ công | Agents có mailbox, identity, handoffs có cấu trúc |
| 4-10 agents = hỗn loạn | Scale thoải mái đến 20-30 agents |
| Work state trong memory | Work state trong Beads (git-backed ledger) |

## Cài Đặt

### Yêu Cầu Hệ Thống

**Bắt buộc:**
- **Go 1.23+** - [go.dev/dl](https://go.dev/dl/)
- **Git 2.25+** - hỗ trợ worktree
- **Beads (bd)** - [github.com/steveyegge/beads](https://github.com/steveyegge/beads)

**Khuyến nghị (full experience):**
- **tmux 3.0+** - giao diện chính
- **Claude Code CLI** - [claude.ai/code](https://claude.ai/code)

### Các Bước Cài Đặt

```bash
# 1. Cài đặt Gastown
go install github.com/steveyegge/gastown/cmd/gt@latest

# 2. Cài đặt Beads (issue tracker)
go install github.com/steveyegge/beads/cmd/bd@latest

# 3. Tạo workspace
gt install ~/gt

# 4. Thêm project đầu tiên
gt rig add myproject https://github.com/you/repo.git

# 5. Vào Mayor's office (khuyến nghị)
cd ~/gt && gt prime
```

### Verify Installation

```bash
# Check versions
gt version
bd version

# Health check
gt doctor

# Show workspace status
gt status
```

## Khái Niệm Core

### 1. The Mayor (Điều Phối Viên AI)

Mayor là AI coordinator của bạn - Claude Code với full context về workspace, projects, và agents. Đây là interface chính để tương tác với Gastown.

```bash
# Khởi động Mayor session
cd ~/gt && gt prime

# Trong Mayor session, chỉ cần nói:
# "Help me fix the authentication bug in myproject"
# "Create a convoy for issues 123 and 456"
# "What's the status of my work?"
```

### 2. Cấu Trúc Town

```
Town (~/gt/)              Workspace của bạn
├── Mayor                 AI coordinator (bắt đầu từ đây)
├── Rig (project)         Container cho git project + agents
│   ├── Polecats          Workers (ephemeral, spawn → work → disappear)
│   ├── Witness           Giám sát workers, quản lý lifecycle
│   └── Refinery          Xử lý merge queue
```

### 3. Vai Trò (Roles)

**Infrastructure Roles:**

| Role | Mô Tả | Lifecycle |
|------|-------|-----------|
| **Mayor** | Global coordinator tại town root | Singleton, persistent |
| **Deacon** | Background supervisor daemon | Singleton, persistent |
| **Witness** | Per-rig polecat lifecycle manager | Một per rig, persistent |
| **Refinery** | Per-rig merge queue processor | Một per rig, persistent |

**Worker Roles:**

| Role | Mô Tả | Lifecycle |
|------|-------|-----------|
| **Polecat** | Ephemeral worker với worktree riêng | Transient, Witness-managed |
| **Crew** | Persistent worker với clone riêng | Long-lived, user-managed |
| **Dog** | Deacon helper cho infrastructure tasks | Ephemeral, Deacon-managed |

### 4. Convoys - Theo Dõi Công Việc

**Convoy** (🚚) là đơn vị tracking cho batched work. Khi bắt đầu việc, tạo convoy để track.

```bash
# Tạo convoy tracking issues
gt convoy create "Feature X" issue-123 issue-456 --notify --human

# Check progress
gt convoy list

# Chi tiết convoy
gt convoy status hq-cv-abc
```

**Tại sao cần convoys:**
- Single view "what's in flight"
- Cross-rig tracking (convoy trong hq-*, issues trong gt-*, bd-*)
- Auto-notification khi work lands
- Historical record của completed work

## Workflows

### Workflow 1: Full Stack (Khuyến Nghị)

Agents chạy trong tmux sessions với Mayor làm interface.

```bash
# Khởi động Gas Town (daemon + Mayor)
gt start

# Vào Mayor session
cd ~/gt && gt prime

# Trong Mayor session:
# "Create a convoy for issues 123 and 456 in myproject"
# "What's the status of my work?"
# "Show me what the witness is doing"

# Hoặc dùng CLI commands:
gt convoy create "Feature X" issue-123 issue-456
gt sling issue-123 myproject           # Spawns polecat tự động
gt convoy list                         # Dashboard view
gt agents                              # Navigate giữa sessions
```

### Workflow 2: Minimal (Không Tmux)

Chạy Claude Code instances thủ công. Gas Town chỉ track state.

```bash
# Tạo convoy
gt convoy create "Fix bugs" issue-123

# Assign work
gt sling issue-123 myproject

# Agent đọc mail, chạy work
claude --resume

# Check progress
gt convoy list
```

### Workflow 3: Cooking Formulas

Formulas định nghĩa structured workflows. Cook chúng, sling cho agents.

**Ví dụ Formula:**

```toml
# .beads/formulas/shiny.formula.toml
formula = "shiny"
description = "Design before code, review before ship"

[[steps]]
id = "design"
description = "Think about architecture"

[[steps]]
id = "implement"
needs = ["design"]

[[steps]]
id = "test"
needs = ["implement"]

[[steps]]
id = "submit"
needs = ["test"]
```

**Sử dụng:**

```bash
# Xem available formulas
bd formula list

# Cook thành protomolecule
bd cook shiny

# Pour thành runnable molecule
bd mol pour shiny --var feature=auth

# Track với convoy
gt convoy create "Auth feature" gt-xyz

# Assign cho worker
gt sling gt-xyz myproject

# Monitor progress
gt convoy list
```

**States of Matter (MEOW - Molecular Expression Of Work):**

| Phase | Name | Storage | Behavior |
|-------|------|---------|----------|
| Ice-9 | Formula | `.beads/formulas/` | Source template, composable |
| Solid | Protomolecule | `.beads/` | Frozen template, reusable |
| Liquid | Mol | `.beads/` | Flowing work, persistent |
| Vapor | Wisp | `.beads/` (ephemeral flag) | Transient, for patrols |

**Operators:**

| Operator | From → To | Effect |
|----------|-----------|--------|
| `cook` | Formula → Protomolecule | Expand macros, flatten |
| `pour` | Proto → Mol | Instantiate as persistent |
| `wisp` | Proto → Wisp | Instantiate as ephemeral |
| `squash` | Mol/Wisp → Digest | Condense to permanent record |
| `burn` | Wisp → ∅ | Discard without record |

## Lệnh Quan Trọng

### Cho Người Dùng (Overseer)

```bash
gt start                          # Khởi động Gas Town (daemon + agents)
gt shutdown                       # Graceful shutdown
gt status                         # Town overview
gt <role> attach                  # Jump vào agent session
                                  # vd: gt mayor attach, gt witness attach
```

### Cho Agents

**Convoy (primary dashboard):**

```bash
gt convoy list                    # Active work across tất cả rigs
gt convoy status <id>             # Detailed convoy progress
gt convoy create "name" <issues>  # Tạo convoy mới
```

**Work assignment:**

```bash
gt sling <bead> <rig>             # Assign work cho polecat
bd ready                          # Show available work
bd list --status=in_progress      # Active work
bd list --status=open             # All open issues
bd show <id>                      # Detailed issue view với dependencies
```

**Communication:**

```bash
gt mail inbox                     # Check messages
gt mail send <addr> -s "..." -m "..."
```

**Lifecycle:**

```bash
gt handoff                        # Request session cycle
gt peek <agent>                   # Check agent health
```

**Diagnostics:**

```bash
gt doctor                         # Health check
gt doctor --fix                   # Auto-repair
gt doctor --verbose               # Detailed errors
```

**Dependencies & Blocking:**

```bash
bd dep add <issue> <depends-on>   # Add dependency (issue depends on depends-on)
bd blocked                        # Show all blocked issues
```

**Creating & Updating:**

```bash
bd create --title="..." --type=task|bug|feature --priority=2
bd update <id> --status=in_progress    # Claim work
bd update <id> --assignee=username     # Assign to someone
bd close <id>                          # Mark complete
bd close <id1> <id2> ...               # Close multiple issues (efficient)
bd close <id> --reason="explanation"   # Close with reason
```

**Sync & Collaboration:**

```bash
bd sync                           # Sync with git remote (run at session end)
bd sync --status                  # Check sync status without syncing
```

**Project Health:**

```bash
bd stats                          # Project statistics (open/closed/blocked counts)
```

## Crew vs Polecats

| Aspect | Crew | Polecat |
|--------|------|---------|
| **Lifecycle** | Persistent (user controls) | Transient (Witness controls) |
| **Monitoring** | None | Witness watches, nudges, recycles |
| **Work assignment** | Human-directed hoặc self-assigned | Slung via `gt sling` |
| **Git state** | Pushes to main trực tiếp | Works on branch, Refinery merges |
| **Cleanup** | Manual | Automatic on completion |
| **Identity** | `<rig>/crew/<name>` | `<rig>/polecats/<name>` |

**Khi nào dùng Crew:**
- Exploratory work
- Long-running projects
- Work cần human judgment
- Tasks muốn direct control

**Khi nào dùng Polecats:**
- Discrete, well-defined tasks
- Batch work (tracked via convoys)
- Parallelizable work
- Work hưởng lợi từ supervision

## Cross-Rig Work Patterns

### Option 1: Worktrees (Preferred)

Tạo worktree trong target rig:

```bash
# gastown/crew/joe cần fix beads bug
gt worktree beads
# Tạo ~/gt/beads/crew/gastown-joe/
# Identity preserved: BD_ACTOR = gastown/crew/joe
```

Directory structure:
```
~/gt/beads/crew/gastown-joe/     # joe from gastown working on beads
~/gt/gastown/crew/beads-wolf/    # wolf from beads working on gastown
```

### Option 2: Dispatch to Local Workers

Cho work nên owned bởi target rig:

```bash
# Tạo issue trong target rig
bd create --prefix beads "Fix authentication bug"

# Tạo convoy và sling to target rig
gt convoy create "Auth fix" bd-xyz
gt sling bd-xyz beads
```

### Khi Nào Dùng Gì

| Scenario | Approach |
|----------|----------|
| Cần fix something quick | Worktree |
| Work nên appear trong CV của bạn | Worktree |
| Work nên done bởi target rig team | Dispatch |
| Infrastructure/system task | Let Deacon handle it |

## The Propulsion Principle

> **Nếu hook của bạn có work, CHẠY NGAY.**

Agents wake up, check hook, execute molecule. Không đợi confirmation. Gas Town là steam engine - agents là pistons.

Molecules survive crashes - any agent có thể continue từ chỗ agent khác dừng lại.

## Identity và Attribution

Tất cả work được attributed cho actor thực hiện:

```
Git commits:      Author: gastown/crew/joe <owner@example.com>
Beads issues:     created_by: gastown/crew/joe
Events:           actor: gastown/crew/joe
```

Identity preserved ngay cả khi working cross-rig:
- `gastown/crew/joe` working trong `~/gt/beads/crew/gastown-joe/`
- Commits vẫn attributed cho `gastown/crew/joe`
- Work appears trên CV của joe, không phải beads rig's workers

## Common Workflows

**Starting work:**

```bash
bd ready           # Find available work
bd show <id>       # Review issue details
bd update <id> --status=in_progress  # Claim it
```

**Completing work:**

```bash
bd close <id1> <id2> ...    # Close all completed issues at once
bd sync                     # Push to remote
```

**Creating dependent work:**

```bash
# Run bd create commands in parallel (use subagents for many items)
bd create --title="Implement feature X" --type=feature
bd create --title="Write tests for X" --type=task
bd dep add beads-yyy beads-xxx  # Tests depend on Feature
```

## Shell Completions

Enable tab completion cho `gt` commands:

**Bash:**

```bash
# Add to ~/.bashrc
source <(gt completion bash)

# Or install permanently
gt completion bash > /usr/local/etc/bash_completion.d/gt
```

**Zsh:**

```bash
# Add to ~/.zshrc (before compinit)
source <(gt completion zsh)

# Or install to fpath
gt completion zsh > "${fpath[1]}/_gt"
```

**Fish:**

```bash
gt completion fish > ~/.config/fish/completions/gt.fish
```

## Troubleshooting

### `gt: command not found`

Go bin directory không trong PATH:

```bash
# Add to shell config (~/.bashrc, ~/.zshrc)
export PATH="$PATH:$HOME/go/bin"
source ~/.bashrc  # or restart terminal
```

### `bd: command not found`

Beads CLI chưa cài:

```bash
go install github.com/steveyegge/beads/cmd/bd@latest
```

### `gt doctor` shows errors

Run với `--fix` để auto-repair:

```bash
gt doctor --fix

# For persistent issues
gt doctor --verbose
```

### Daemon not starting

Check tmux installed và working:

```bash
tmux -V                    # Should show version
tmux new-session -d -s test && tmux kill-session -t test  # Quick test
```

### Beads sync issues

Nếu beads không sync across clones:

```bash
cd ~/gt/myproject/mayor/rig
bd sync --status           # Check sync status
bd doctor                  # Run beads health check
```

## Updating

Update Gas Town và Beads:

```bash
go install github.com/steveyegge/gastown/cmd/gt@latest
go install github.com/steveyegge/beads/cmd/bd@latest
gt doctor --fix            # Fix any post-update issues
```

## Common Mistakes

1. **Dùng dogs cho user work** - Dogs là Deacon infrastructure. Dùng crew hoặc polecats.
2. **Nhầm crew với polecats** - Crew là persistent và human-managed. Polecats là transient và Witness-managed.
3. **Working trong wrong directory** - Gas Town dùng cwd cho identity detection. Stay trong home directory.
4. **Đợi confirmation khi work đã hooked** - Hook LÀ assignment. Execute ngay.
5. **Tạo worktrees khi nên dispatch** - Nếu work nên owned bởi target rig, dispatch thay vì worktree.

## Model Evaluation và A/B Testing

Attribution và work history features của Gas Town enable objective model comparison:

```bash
# Deploy different models on similar tasks
gt sling gt-abc gastown --model=claude-sonnet
gt sling gt-def gastown --model=gpt-4

# Compare outcomes
bd stats --actor=gastown/polecats/* --group-by=model
```

Vì mỗi task có completion time, quality signals, và revision count, bạn có thể make data-driven decisions về models để deploy ở đâu.

Đặc biệt valuable cho:
- **Model selection:** Model nào handle codebase tốt nhất?
- **Capability mapping:** Claude cho architecture, GPT cho tests?
- **Cost optimization:** Khi nào smaller model đủ?

## Resources

- **GitHub:** [github.com/steveyegge/gastown](https://github.com/steveyegge/gastown)
- **Beads:** [github.com/steveyegge/beads](https://github.com/steveyegge/beads)
- **Documentation:** Xem `docs/` trong repo
- **Issues:** Report tại GitHub Issues

## Next Steps

Sau khi cài đặt:

1. **Đọc README** - Core concepts và workflows
2. **Try simple workflow** - `gt convoy create "Test" test-issue`
3. **Explore docs** - `docs/reference.md` cho command reference
4. **Run doctor regularly** - `gt doctor` catches problems sớm
