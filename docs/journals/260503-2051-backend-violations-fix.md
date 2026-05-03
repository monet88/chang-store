---
date: 2026-05-03
type: technical-journal
status: resolved
branch: feat/backend-foundation
components:
  - backend
  - api-routing
  - database-adapter
  - rate-limiter
  - documentation
---

# Backend Violation Fix: Method Guard, Neon Row Count, Rate Limiter, Docs

## Context

Scout/review violations targeted backend foundation correctness and docs drift. Main risk sat in `server/neon.ts` and `server/db.ts`: shared DB adapter behavior affects auth, jobs, assets, and rate limiter flows.

## What Happened

### Method guard ordering

`api/jobs/index.ts` created a Neon DB wrapper and read session auth before rejecting unsupported HTTP methods. Unsupported methods that reached the handler could spend DB/session work before returning 405.

Fix: moved method whitelist check to top of handler. Unsupported methods now return 405 before DB pool access or session lookup.

### Neon adapter dropped `rowCount`

`server/neon.ts` returned only `{ rows }` from pool and transaction queries. `server/db.ts` expected `rowCount` for conditional job status updates, so `rowCount === 0` never fired when the adapter omitted the field.

Fix: forwarded `rowCount` from both Neon query paths and changed expected-status guard to fail closed on `rowCount !== 1`.

### Rate limiter cleanup in hot path

`server/rate-limiter-storage.ts` deleted expired `rate_limit_entries` rows on every `increment()`. Login rate limiting could run a table-wide cleanup for every attempt.

Fix: cleanup now runs once per rate-limit window per storage instance, then increments use only the upsert path inside the same window.

### Documentation and env drift

Docs claimed feature flags gated auth/job queue, backend execution was durable, and results returned signed URL assets. Code showed flags were not consumed, jobs were fire-and-forget with stale sweep recovery, and `/api/jobs/:id/results` returns `{ job, results }` DB asset records.

Fix: updated `.env.example`, `README.md`, `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/project-overview-pdr.md`, and `docs/code-standards.md` to match runtime behavior, inventories, and coverage thresholds. `.env.example` now avoids `AUTH_SEEDED_USERS_JSON=[]` because explicit empty list disables seeded logins.

## Decisions

- Chose fail-closed `rowCount !== 1` over `rowCount === 0` because missing adapter metadata should not permit conditional state transitions.
- Chose per-window rate-limit cleanup over probabilistic cleanup because current window value already provides a deterministic cleanup boundary.
- Chose docs correction over wiring feature flags because issue was stale configuration guidance, not requested runtime behavior change.

## Verification

| Check | Result |
|-------|--------|
| Targeted tests (`jobRunner`, `rateLimiter`, `jobs-index-route`) | 32/32 passed |
| Full test suite | 555/555 passed |
| `npx tsc --noEmit` | Passed |
| Modified-file ESLint | Passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Code review | No blockers |
| GitNexus detect_changes | Critical risk expected due `buildDB` blast radius; reviewed |

## Next

Repo-wide `npm run lint` still fails on pre-existing `.cjs` baseline issues outside this diff. Track separately; current modified TypeScript files lint clean.
