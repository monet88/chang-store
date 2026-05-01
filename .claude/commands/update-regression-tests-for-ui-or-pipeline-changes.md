---
name: update-regression-tests-for-ui-or-pipeline-changes
description: Workflow command scaffold for update-regression-tests-for-ui-or-pipeline-changes in chang-store.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-regression-tests-for-ui-or-pipeline-changes

Use this workflow when working on **update-regression-tests-for-ui-or-pipeline-changes** in `chang-store`.

## Goal

Keeps regression and integration tests in sync with recent UI or pipeline changes to ensure CI and type checks reflect the current component and API contracts.

## Common Files

- `__tests__/components/*.test.tsx`
- `__tests__/hooks/*.test.tsx`
- `src/components/*.tsx`
- `src/hooks/*.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify affected UI components or hooks (e.g., src/components/UtilityDock.tsx, src/hooks/useJobPoll.ts)
- Update or add corresponding test files (e.g., __tests__/components/UtilityDock.test.tsx, __tests__/hooks/useJobPoll.test.tsx)
- Ensure tests cover new or changed behaviors, props, or API interactions
- Run CI/type checks to confirm alignment

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.