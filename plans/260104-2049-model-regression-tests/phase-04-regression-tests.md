# Phase 4: Regression Test Suite

**Status:** Pending
**Priority:** P2
**Effort:** 3h

---

## Overview

Create Vitest regression tests that use comparison engine. Integrates baselines into test suite with opt-in execution.

---

## Related Code Files

### To Create

1. **`__tests__/regression/regression.test.ts`** (150 lines)
   - Main regression test file
   - Uses compareBaselines() engine
   - Vitest integration

2. **`__tests__/regression/setup.ts`** (40 lines)
   - Test environment setup
   - Skip tests if `RUN_REGRESSION_TESTS=false`

---

## Implementation Steps

### Step 1: Test File (2h)

```typescript
// __tests__/regression/regression.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { compareBaselines } from '../baselines/compareBaseline';
import { ComparisonReport } from '../baselines/types';

/**
 * Regression Tests for AI Model Outputs
 *
 * **IMPORTANT:** These tests make REAL API calls.
 *
 * To run:
 *   RUN_REGRESSION_TESTS=true npm test -- __tests__/regression
 *
 * To skip (default):
 *   npm test  (regression tests skipped)
 */

const RUN_REGRESSION_TESTS = process.env.RUN_REGRESSION_TESTS === 'true';

describe.skipIf(!RUN_REGRESSION_TESTS)('Model Regression Tests', () => {
  let reports: ComparisonReport[];

  beforeAll(async () => {
    console.log('🔍 Running regression comparison against baselines...');
    reports = await compareBaselines({ all: true });
  }, 300000); // 5min timeout

  it('should detect no breaking changes in Gemini image editing', () => {
    const geminiImageReports = reports.filter(r =>
      r.baseline.operation.service === 'gemini/image' &&
      r.baseline.operation.name === 'editImage'
    );

    const failures = geminiImageReports.filter(r => !r.result.passed);

    if (failures.length > 0) {
      const details = failures.map(f => ({
        model: f.baseline.operation.model,
        failures: f.result.failures.map(fail => fail.reason),
      }));

      expect.fail(
        `Breaking changes detected in Gemini image editing:\n${JSON.stringify(details, null, 2)}`
      );
    }

    expect(failures).toHaveLength(0);
  });

  it('should detect no breaking changes in Imagen generation', () => {
    const imagenReports = reports.filter(r =>
      r.baseline.operation.model.includes('imagen')
    );

    const failures = imagenReports.filter(r => !r.result.passed);
    expect(failures).toHaveLength(0);
  });

  it('should detect no breaking changes in video generation', () => {
    const videoReports = reports.filter(r =>
      r.baseline.operation.service.includes('video')
    );

    const failures = videoReports.filter(r => !r.result.passed);
    expect(failures).toHaveLength(0);
  });

  it('should detect no breaking changes in AIVideoAuto models', () => {
    const aivideoReports = reports.filter(r =>
      r.baseline.operation.service === 'aivideoauto'
    );

    const failures = aivideoReports.filter(r => !r.result.passed);
    expect(failures).toHaveLength(0);
  });

  it('should generate comparison report', () => {
    // Write report to file
    const markdown = generateReport(reports);
    fs.writeFileSync('regression-report.md', markdown);

    console.log('\n📄 Report saved to: regression-report.md');
  });

  // Individual model tests
  describe('Gemini 3 Flash', () => {
    it('editImage should match baseline', () => {
      const report = reports.find(r =>
        r.baseline.operation.model === 'gemini-3-flash-preview' &&
        r.baseline.operation.name === 'editImage'
      );

      expect(report).toBeDefined();
      expect(report!.result.passed).toBe(true);
    });

    it('generateImage should match baseline', () => {
      // ...
    });
  });

  describe('Imagen 4', () => {
    it('generateImage should match baseline', () => {
      // ...
    });
  });

  describe('Veo 2', () => {
    it('generateVideo should match baseline', () => {
      // ...
    });
  });
});
```

### Step 2: Environment Setup (30min)

```typescript
// __tests__/regression/setup.ts

/**
 * Regression test environment setup
 *
 * Validates:
 * - API keys are configured
 * - Baselines exist
 * - Dependencies are installed
 */

import { existsSync } from 'fs';
import { beforeAll } from 'vitest';

if (process.env.RUN_REGRESSION_TESTS === 'true') {
  beforeAll(() => {
    // Check API keys
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not set - cannot run regression tests');
    }

    // Check baselines exist
    if (!existsSync('__baselines__')) {
      throw new Error('Baselines not found. Run: npm run test:baseline:capture');
    }

    // Check dependencies
    try {
      require('sharp');
      require('phash');
    } catch (err) {
      throw new Error('Missing dependencies. Run: npm install --save-dev sharp phash');
    }

    console.log('✅ Regression test environment validated');
  });
}
```

### Step 3: Package.json Scripts (15min)

```json
{
  "scripts": {
    "test:baseline:capture": "tsx __tests__/baselines/cli.ts capture",
    "test:baseline:compare": "tsx __tests__/baselines/cli.ts compare",
    "test:regression": "RUN_REGRESSION_TESTS=true vitest run __tests__/regression",
    "test:regression:watch": "RUN_REGRESSION_TESTS=true vitest __tests__/regression"
  }
}
```

### Step 4: Documentation (15min)

**File:** `__baselines__/README.md`

```markdown
# Model Output Baselines

This directory contains baseline snapshots of AI model outputs for regression testing.

## Structure

- `gemini/` - Google Gemini API baselines
- `aivideoauto/` - AIVideoAuto API baselines
- `metadata.json` - Global metadata

## Baseline Files

Each `.json` file contains:
- Input parameters used
- Output metadata (dimensions, file size, pHash)
- Comparison thresholds
- Capture timestamp and environment

## Usage

### Capture New Baselines

```bash
# Capture all baselines
npm run test:baseline:capture -- --all

# Capture specific model
npm run test:baseline:capture -- --model gemini-3-flash

# Capture specific operation
npm run test:baseline:capture -- --operation editImage
```

### Compare Against Baselines

```bash
# Compare all
npm run test:baseline:compare -- --all

# Compare specific model
npm run test:baseline:compare -- --model gemini-3-flash
```

### Run Regression Tests

```bash
# Run regression test suite
npm run test:regression

# Watch mode
npm run test:regression:watch
```

## When to Update Baselines

Update baselines when:
1. ✅ Intentionally upgrading to newer model version
2. ✅ Changing model configuration (resolution, aspect ratio)
3. ❌ NOT when tests fail - investigate root cause first

## Baseline Refresh Workflow

1. **Create branch**
   ```bash
   git checkout -b update-baselines-gemini-3-flash
   ```

2. **Capture new baselines**
   ```bash
   npm run test:baseline:capture -- --model gemini-3-flash
   ```

3. **Review changes**
   ```bash
   git diff __baselines__/
   ```

4. **Run regression tests**
   ```bash
   npm run test:regression
   ```

5. **Commit and PR**
   ```bash
   git add __baselines__/
   git commit -m "chore: update baselines for gemini-3-flash upgrade"
   git push origin update-baselines-gemini-3-flash
   ```

6. **Get approval** before merging

## Troubleshooting

### Test failures

If regression tests fail:
1. Check comparison report: `regression-report.md`
2. Identify which thresholds were exceeded
3. Determine if change is intentional (model upgrade) or bug
4. Update baseline if intentional, fix bug otherwise

### Missing baselines

```bash
npm run test:baseline:capture -- --all
```

### API errors

- Check API keys are set
- Verify quota limits
- Check network connectivity
```

---

## Todo List

- [ ] Create regression.test.ts with Vitest integration
- [ ] Create setup.ts for environment validation
- [ ] Add package.json scripts
- [ ] Create __baselines__/README.md documentation
- [ ] Test regression suite with existing baselines
- [ ] Test skip behavior when RUN_REGRESSION_TESTS=false
- [ ] Test report generation
- [ ] Verify timeout handling (5min)

---

## Success Criteria

- ✅ `npm run test:regression` runs regression tests
- ✅ Tests skipped by default (RUN_REGRESSION_TESTS=false)
- ✅ Tests run with environment variable set
- ✅ Report generated to `regression-report.md`
- ✅ Zero failures with current baselines
- ✅ Documentation complete

---

## Next Steps

After Phase 4: Proceed to Phase 5 - CI/CD Integration
