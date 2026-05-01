```markdown
# chang-store Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development patterns and workflows used in the `chang-store` repository, a TypeScript project built with Vite. The codebase features a modular backend job pipeline, robust authentication, and a modern React frontend. It emphasizes maintainable code through clear conventions, comprehensive testing with Vitest, and repeatable workflows for adding features, hardening systems, and keeping tests in sync.

---

## Coding Conventions

**File Naming**
- Use `camelCase` for files and folders.
  - Example: `jobService.ts`, `useJobPoll.ts`, `jobHistoryView.tsx`

**Import Style**
- Use relative imports.
  - Example:
    ```typescript
    import { runJob } from '../workflows/feature-runner';
    import { useJobPoll } from '../../hooks/useJobPoll';
    ```

**Export Style**
- Prefer named exports.
  - Example:
    ```typescript
    // src/services/jobService.ts
    export function startJob(params: JobParams) { ... }
    export function getJobStatus(id: string) { ... }
    ```

**Commit Messages**
- Use [Conventional Commits](https://www.conventionalcommits.org/).
- Prefixes: `fix`, `feat`, `test`, `chore`
- Example: `feat: add job status badge component`

---

## Workflows

### Add or Migrate Backend Feature with Job Pipeline

**Trigger:** When adding a new backend feature or migrating an existing one to the jobs pipeline.  
**Command:** `/migrate-feature-to-job-pipeline`

1. **Create or update API route files**  
   - Add files under `api/jobs/` (e.g., `[id].ts`, `results.ts`, `index.ts`).
   - Example:
     ```typescript
     // api/jobs/[id].ts
     export async function getJobById(req, res) { ... }
     ```

2. **Add or update workflow runner logic**  
   - Edit or create files like `workflows/feature-runner.ts`, `workflows/helpers.ts`, or `server/workflows/job-runner.ts`.

3. **Update or add database migration files**  
   - Create migration scripts for new tables/fields (e.g., `migrations/002_job_tables.sql`).

4. **Update server adapters or executors**  
   - Modify files in `server/adapters/` or `server/gemini.ts` as needed.

5. **Integrate with frontend service and hooks**  
   - Update `src/services/jobService.ts`, `src/hooks/useJobPoll.ts`, or create new hooks like `useFeature.ts`.

6. **Update or add frontend components for job status/history**  
   - Add or update `src/components/JobStatusBadge.tsx`, `src/components/JobHistoryView.tsx`.

7. **Write or update tests for new/migrated features**  
   - Add tests in `__tests__/hooks/useFeature.test.tsx`, `__tests__/services/jobRunner.test.ts`.

---

### Harden or Fix Backend Pipeline and Auth

**Trigger:** When fixing bugs or improving reliability in the job pipeline or authentication system.  
**Command:** `/fix-pipeline-or-auth`

1. **Update backend logic for auth or job pipeline**  
   - Edit files like `api/_lib/auth.ts`, `api/_lib/rate-limiter.ts`, `server/db.ts`, or `server/adapters/base-adapter.ts`.

2. **Update or add tests for affected areas**  
   - Add or update tests in `__tests__/contexts/AuthContext.test.tsx`, `__tests__/hooks/useJobPoll.test.tsx`.

3. **Update frontend hooks and components**  
   - Ensure `src/hooks/useJobPoll.ts` and `src/components/JobHistoryView.tsx` reflect backend changes.

4. **Update workflow runner or helpers if needed**  
   - Modify `workflows/feature-runner.ts`, `workflows/helpers.ts`.

5. **Update project documentation if relevant**  
   - Edit `AGENTS.md`, `CLAUDE.md` to reflect changes.

---

### Update Regression Tests for UI or Pipeline Changes

**Trigger:** When updating UI components or backend APIs and needing to align tests.  
**Command:** `/update-regression-tests`

1. **Identify affected UI components or hooks**  
   - Example: `src/components/UtilityDock.tsx`, `src/hooks/useJobPoll.ts`.

2. **Update or add corresponding test files**  
   - Example: `__tests__/components/UtilityDock.test.tsx`, `__tests__/hooks/useJobPoll.test.tsx`.

3. **Ensure tests cover new or changed behaviors**  
   - Update test cases to reflect new props, API interactions, or behaviors.

4. **Run CI/type checks**  
   - Confirm all tests pass and type checks are clean.

---

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test File Pattern:** Files end with `.test.tsx`
  - Example: `useJobPoll.test.tsx`, `jobRunner.test.ts`
- **Test Structure:**
  - Place tests in `__tests__/` directory, mirroring the structure of the codebase.
  - Example:
    ```
    src/hooks/useJobPoll.ts
    __tests__/hooks/useJobPoll.test.tsx
    ```
- **Sample Test:**
  ```typescript
  // __tests__/hooks/useJobPoll.test.tsx
  import { renderHook } from '@testing-library/react';
  import { useJobPoll } from '../../src/hooks/useJobPoll';

  test('polls job status', async () => {
    const { result } = renderHook(() => useJobPoll('job123'));
    expect(result.current.status).toBe('pending');
  });
  ```

---

## Commands

| Command                         | Purpose                                                         |
|----------------------------------|-----------------------------------------------------------------|
| /migrate-feature-to-job-pipeline | Add or migrate a backend feature to the job pipeline            |
| /fix-pipeline-or-auth            | Apply fixes or harden the job pipeline/authentication system    |
| /update-regression-tests         | Update regression tests for UI or pipeline changes              |
```
