---
parent: plan.md
status: pending
effort: 30m
---

# Phase 01: Surgical Edits

## Context
- **Target**: `C:\Users\monet\.claude\CLAUDE.md`
- **Current**: 407 lines
- **Goal**: ~420 lines with updated agent/skill patterns

## Edits

### Edit 1: Tool Selection → Cost Hierarchy
**Location**: Lines 102-107 (Tool Selection table)

**Find**:
```markdown
| Tool | Cost | When to Use |
|------|------|-------------|
| \`grep\`, \`glob\`, \`lsp_*\`, \`ast_grep\` | FREE | Not Complex, Scope Clear, No Implicit Assumptions |
| \`explore\` agent | FREE | Multiple search angles, unfamiliar modules, cross-layer patterns |
| \`librarian\` agent | CHEAP | External docs, GitHub examples, OpenSource Implementations, OSS reference |
| \`oracle\` agent | EXPENSIVE | Architecture, review, debugging after 2+ failures |
```

**Replace with**:
```markdown
### Tool/Agent Cost Hierarchy

| Tier | Agents | When |
|------|--------|------|
| **Tier 1** | Direct tools, \`codebase-search\`, \`explore\` | Always first |
| **Tier 2** | \`librarian\`, \`debugger\`, \`tester\`, \`code-reviewer\` | Normal workflow |
| **Tier 3** | \`oracle\`, \`brainstormer\` | 2+ failures, complex decisions |
```

---

### Edit 2: Delegation Table → Dynamic
**Location**: Lines 184-190 (Delegation Table)

**Find**:
```markdown
| Domain | Delegate To | Trigger |
|--------|-------------|---------|
| Explore | \`explore\` | Find existing codebase structure, patterns and styles |
| Librarian | \`librarian\` | Unfamiliar packages / libraries, struggles at weird behaviour (to find existing implementation of opensource) |
| Documentation | \`document-writer\` | README, API docs, guides |
```

**Replace with**:
```markdown
### Agent Selection

Check Task tool for agents. Match task:

| Task Type | Agent |
|-----------|-------|
| Find files/code | \`codebase-search\` |
| Understand context | \`explore\` |
| External docs | \`librarian\`, \`researcher\` |
| Bug/error | \`debugger\` |
| Quality | \`tester\`, \`code-reviewer\` |
| 2+ failures | \`oracle\` |
| Specialized | Check agent descriptions |
```

---

### Edit 3: Insert Skills Discovery
**Location**: After Edit 2 (after Agent Selection section)

**Insert**:
```markdown

### Skills Discovery

Match task to \`/skill-name\`. Universal triggers:
- Bug → \`/debugging\`
- Pre-implement → \`/confidence-check\`
- Post-implement → \`/code-review\`
- Need docs → \`/docs-seeker\`
```

---

### Edit 4: Phase 2C Recovery Flow
**Location**: Lines 252-260 (After 3 Consecutive Failures section)

**Find**:
```markdown
### After 3 Consecutive Failures:

1. **STOP** all further edits immediately
2. **REVERT** to last known working state (git checkout / undo edits)
3. **DOCUMENT** what was attempted and what failed
4. **CONSULT** Oracle with full failure context
5. If Oracle cannot resolve → **ASK USER** before proceeding
```

**Replace with**:
```markdown
### Failure Recovery Flow

1. Bug → Fire \`debugger\` immediately
2. After 2+ failures → Consult \`oracle\`
3. Oracle fails → **ASK USER**

**Before escalating**:
1. **STOP** all further edits immediately
2. **REVERT** to last known working state (git checkout / undo edits)
3. **DOCUMENT** what was attempted and what failed
```

---

## Todo
- [ ] Read current file to verify exact content matches
- [ ] Apply Edit 1: Tool Selection → Cost Hierarchy
- [ ] Apply Edit 2: Delegation Table → Dynamic
- [ ] Apply Edit 3: Insert Skills Discovery
- [ ] Apply Edit 4: Phase 2C Recovery
- [ ] Verify line count ~420
- [ ] Verify no broken markdown

## Success Criteria
- All 4 edits applied cleanly
- File renders correctly in markdown viewer
- No syntax errors
