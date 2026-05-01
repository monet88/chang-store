---
name: add-or-migrate-backend-feature-with-job-pipeline
description: Workflow command scaffold for add-or-migrate-backend-feature-with-job-pipeline in chang-store.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-migrate-backend-feature-with-job-pipeline

Use this workflow when working on **add-or-migrate-backend-feature-with-job-pipeline** in `chang-store`.

## Goal

Implements or migrates a backend feature to run as a durable job, including API route creation, workflow runner wiring, database changes, and frontend integration.

## Common Files

- `api/jobs/[id].ts`
- `api/jobs/results.ts`
- `api/jobs/index.ts`
- `workflows/feature-runner.ts`
- `workflows/helpers.ts`
- `server/workflows/job-runner.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update API route files under api/jobs/ (e.g., [id].ts, results.ts, index.ts)
- Add or update workflow runner logic (e.g., workflows/feature-runner.ts, workflows/helpers.ts, server/workflows/job-runner.ts)
- Update or add database migration files for new tables or fields (e.g., migrations/002_job_tables.sql)
- Update server adapters or executors (e.g., server/adapters/*.ts, server/gemini.ts)
- Integrate with frontend service and hooks (e.g., src/services/jobService.ts, src/hooks/useJobPoll.ts, src/hooks/useFeature.ts)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.