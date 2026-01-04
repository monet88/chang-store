# Phase 5: CI/CD Integration

**Status:** Pending
**Priority:** P2
**Effort:** 2h

---

## Overview

Integrate regression tests into CI/CD pipeline with manual triggers. Prevents accidental model regressions before deployment.

---

## Related Code Files

### To Create

1. **`.github/workflows/regression-tests.yml`** (60 lines)
   - GitHub Actions workflow
   - Manual trigger (workflow_dispatch)
   - Scheduled run (optional)

2. **`__tests__/regression/ci-config.ts`** (40 lines)
   - CI-specific configuration
   - Timeout handling
   - Report upload

---

## Implementation Steps

### Step 1: GitHub Actions Workflow (1h)

```yaml
# .github/workflows/regression-tests.yml

name: Model Regression Tests

on:
  # Manual trigger
  workflow_dispatch:
    inputs:
      model:
        description: 'Specific model to test (optional)'
        required: false
        type: string
      operation:
        description: 'Specific operation to test (optional)'
        required: false
        type: string

  # Optional: Schedule weekly baseline comparison
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday at midnight

jobs:
  regression-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30  # Generous timeout for API calls

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install ffprobe
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Run regression tests
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          AIVIDEOAUTO_ACCESS_TOKEN: ${{ secrets.AIVIDEOAUTO_ACCESS_TOKEN }}
          RUN_REGRESSION_TESTS: 'true'
        run: |
          if [ -n "${{ inputs.model }}" ]; then
            npm run test:baseline:compare -- --model="${{ inputs.model }}"
          elif [ -n "${{ inputs.operation }}" ]; then
            npm run test:baseline:compare -- --operation="${{ inputs.operation }}"
          else
            npm run test:baseline:compare -- --all
          fi

          # Run Vitest regression tests
          npm run test:regression

      - name: Upload regression report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: regression-report
          path: regression-report.md

      - name: Comment on PR (if triggered from PR)
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('regression-report.md', 'utf8');

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🧪 Regression Test Results\n\n${report}`
            });

      - name: Fail if regressions detected
        run: |
          if grep -q "❌ FAIL" regression-report.md; then
            echo "::error::Breaking changes detected in model outputs!"
            exit 1
          fi
```

### Step 2: CI Configuration (30min)

```typescript
// __tests__/regression/ci-config.ts

/**
 * CI-specific configuration for regression tests
 */

export const CI_CONFIG = {
  // Longer timeouts in CI
  apiTimeout: 60000,  // 60s per API call

  // Retry failed API calls
  maxRetries: 3,
  retryDelay: 5000,  // 5s

  // Rate limiting
  rateLimitDelay: 2000,  // 2s between calls

  // Report format
  reportFormat: 'markdown',  // or 'json' for programmatic analysis
};

export function isCIEnvironment(): boolean {
  return !!process.env.CI || !!process.env.GITHUB_ACTIONS;
}

export function getAPITimeout(): number {
  return isCIEnvironment() ? CI_CONFIG.apiTimeout : 30000;
}
```

### Step 3: Documentation (30min)

**File:** `docs/regression-testing-guide.md`

```markdown
# Regression Testing Guide

## Overview

Regression tests validate AI model outputs against baselines to detect breaking changes during model upgrades.

## Running Regression Tests

### Locally

```bash
# Ensure baselines exist
npm run test:baseline:capture -- --all

# Run regression tests
RUN_REGRESSION_TESTS=true npm test -- __tests__/regression

# Or use shortcut
npm run test:regression
```

### In CI/CD

#### Manual Trigger

1. Go to **Actions** → **Model Regression Tests**
2. Click **Run workflow**
3. (Optional) Specify model or operation
4. Click **Run workflow** button

#### Scheduled Run

- Runs automatically every Sunday at midnight
- Compares all baselines
- Uploads report as artifact

## Interpreting Results

### ✅ PASS

No breaking changes detected. Safe to proceed.

### ❌ FAIL

Breaking changes detected. Review `regression-report.md`:

1. **Dimension Changes**
   - Indicates aspect ratio or resolution changed
   - May affect UI layouts

2. **File Size Changes**
   - Could indicate quality degradation
   - Or improved compression

3. **pHash Distance**
   - Perceptual difference in visual content
   - Review sample images manually

## Updating Baselines

When model is intentionally upgraded:

```bash
# 1. Create branch
git checkout -b update-baselines-model-name

# 2. Capture new baselines
npm run test:baseline:capture -- --model model-name

# 3. Verify changes
git diff __baselines__/

# 4. Run regression tests (should pass now)
npm run test:regression

# 5. Commit and PR
git add __baselines__/
git commit -m "chore: update baselines for model-name upgrade"
git push origin update-baselines-model-name
```

## Troubleshooting

### API Quota Errors

- Wait for quota reset
- Or capture baselines in batches

### Flaky Tests

- Increase tolerance thresholds in baseline
- Or re-capture baseline multiple times and use median

### CI Timeout

- Increase timeout in `.github/workflows/regression-tests.yml`
- Or test fewer models in CI

## Best Practices

1. **Review before merging** baseline updates
2. **Don't ignore** regression failures
3. **Update baselines** only for intentional changes
4. **Document** why baselines changed in PR description
```

---

## Todo List

- [ ] Create GitHub Actions workflow file
- [ ] Add CI configuration module
- [ ] Set up GitHub secrets (GEMINI_API_KEY, AIVIDEOAUTO_ACCESS_TOKEN)
- [ ] Test manual workflow trigger
- [ ] Test scheduled workflow (dry run)
- [ ] Create regression testing guide
- [ ] Test report upload artifact
- [ ] Test PR comment integration (if applicable)

---

## Success Criteria

- ✅ GitHub Actions workflow configured
- ✅ Manual trigger works
- ✅ Scheduled run works (test with cron)
- ✅ Report uploaded as artifact
- ✅ Secrets configured securely
- ✅ Documentation complete
- ✅ CI fails on breaking changes

---

## Security Considerations

- **API Keys:** Store in GitHub Secrets, never in code
- **Rate Limiting:** Respect API quotas
- **Artifacts:** Reports may contain sensitive prompts - review before sharing

---

## Final Notes

After Phase 5 completion:
1. Run full regression test in CI
2. Validate all workflows
3. Document for team
4. Mark plan as complete!

---

## End of Implementation Plan

**Total Effort:** 16h across 5 phases
**Status:** Ready for implementation
