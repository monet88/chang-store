# Harness Backlog

Use this file when an agent discovers a missing harness capability but should
not change the operating model immediately.

## Template

```md
## Missing Harness Capability

### Title

Short name.

### Discovered While

Task or story that exposed the gap.

### Current Pain

What was hard, repeated, ambiguous, or unsafe?

### Suggested Improvement

What should be added or changed?

### Risk

Tiny, normal, or high-risk.

### Status

proposed | accepted | implemented | rejected
```

## Items

Current durable backlog snapshot from `scripts/harness query backlog` on
2026-05-31:

| ID | Title | Status | Risk | Predicted Impact | Actual Outcome |
| --- | --- | --- | --- | --- | --- |
| 1 | scripts/harness entrypoint is not executable | implemented | tiny | Removes friction from every Harness-driven task | `scripts/harness` marked executable in git index (`100755`). |
| 2 | Remove dead code: useSwapFace and useInpainting | implemented | | | Removed unwired hooks and locale keys. |

Use `scripts/harness query backlog` as source of truth; update this file only as
a human-readable mirror when docs are resynced.

