---
name: harden-or-fix-backend-pipeline-and-auth
description: Workflow command scaffold for harden-or-fix-backend-pipeline-and-auth in chang-store.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /harden-or-fix-backend-pipeline-and-auth

Use this workflow when working on **harden-or-fix-backend-pipeline-and-auth** in `chang-store`.

## Goal

Applies bug fixes, edge case handling, and robustness improvements to the job pipeline and authentication system, including both backend and frontend code and updating regression tests.

## Common Files

- `api/_lib/auth.ts`
- `api/_lib/rate-limiter.ts`
- `api/jobs/index.ts`
- `server/adapters/base-adapter.ts`
- `server/db.ts`
- `src/hooks/useJobPoll.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update backend logic for auth or job pipeline (e.g., api/_lib/auth.ts, api/_lib/rate-limiter.ts, server/db.ts, server/adapters/base-adapter.ts)
- Update or add tests for the affected areas (e.g., __tests__/contexts/AuthContext.test.tsx, __tests__/hooks/useJobPoll.test.tsx)
- Update frontend hooks and components to align with backend changes (e.g., src/hooks/useJobPoll.ts, src/components/JobHistoryView.tsx)
- Update workflow runner or helpers if needed (e.g., workflows/feature-runner.ts, workflows/helpers.ts)
- Update project documentation if relevant (e.g., AGENTS.md, CLAUDE.md)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.