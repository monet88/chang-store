# Brainstorm: Global CLAUDE.md Optimization

## Problem Statement
Global `~/.claude/CLAUDE.md` (407 lines) có Delegation Table và Tool Selection outdated, không leverage full agent/skill ecosystem.

## Requirements
- Compact (~420 lines max)
- Dynamic lookup pattern (không static list)
- Universal patterns only (stack-specific → project CLAUDE.md)

## Evaluated Approaches

### Option A: Full Agent/Skill Catalog
- **Pros**: Complete reference
- **Cons**: 600+ lines, bloated, hard to maintain
- **Verdict**: Rejected

### Option B: Dynamic Lookup + Universal Triggers (Selected)
- **Pros**: Compact, future-proof, self-updating
- **Cons**: Requires Claude to check tool descriptions
- **Verdict**: Selected

## Final Solution

### Change 1: Tool Selection → Cost Hierarchy (L102-107)
```markdown
### Tool/Agent Cost Hierarchy
| Tier | Agents | When |
|------|--------|------|
| **Tier 1** | Direct tools, `codebase-search`, `explore` | Always first |
| **Tier 2** | `librarian`, `debugger`, `tester`, `code-reviewer` | Normal workflow |
| **Tier 3** | `oracle`, `brainstormer` | 2+ failures, complex decisions |
```

### Change 2: Delegation Table → Dynamic (L184-190)
```markdown
### Agent Selection
Check Task tool for agents. Match task:

| Task Type | Agent |
|-----------|-------|
| Find files/code | `codebase-search` |
| Understand context | `explore` |
| External docs | `librarian`, `researcher` |
| Bug/error | `debugger` |
| Quality | `tester`, `code-reviewer` |
| 2+ failures | `oracle` |
| Specialized | Check agent descriptions |
```

### Change 3: Skills Discovery (insert after Delegation)
```markdown
### Skills Discovery
Match task to `/skill-name`. Universal triggers:
- Bug → `/debugging`
- Pre-implement → `/confidence-check`
- Post-implement → `/code-review`
- Need docs → `/docs-seeker`
```

### Change 4: Phase 2C Recovery (L244-260)
```markdown
### Failure Recovery Flow
1. Bug → `debugger`
2. 2+ failures → `oracle`
3. Oracle fails → ASK USER
```

## Implementation Considerations
- File path: `C:\Users\monet\.claude\CLAUDE.md`
- Use Edit tool for surgical changes
- Preserve existing structure/formatting
- Net change: ~+10 lines

## Success Metrics
- [ ] All 4 sections updated
- [ ] File still ~420 lines
- [ ] No broken markdown formatting

## Next Steps
Create implementation plan with exact edit operations.
