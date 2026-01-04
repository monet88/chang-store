# Phase 3: Comparison Engine

**Status:** Pending
**Priority:** P2
**Effort:** 3h

---

## Overview

Build comparison engine that validates new model outputs against baselines. Detects breaking changes based on thresholds.

---

## Related Code Files

### To Create

1. **`__tests__/baselines/compareBaseline.ts`** (120 lines)
   - Load baseline from file
   - Call current model with same inputs
   - Extract metadata from new output
   - Compare against baseline with thresholds
   - Return comparison result

2. **`__tests__/baselines/utils/comparison.ts`** (80 lines)
   - Image comparison logic (dimensions, pHash, file size)
   - Video comparison logic (thumbnail pHash, duration)
   - Threshold validation helpers

3. **`__tests__/baselines/reporter.ts`** (60 lines)
   - Format comparison results
   - Diff visualization
   - Summary statistics

---

## Implementation Steps

### Step 1: Comparison Utilities (1h)

```typescript
// __tests__/baselines/utils/comparison.ts

export interface ComparisonResult {
  passed: boolean;
  failures: ComparisonFailure[];
  diffs: Diff[];
}

export interface ComparisonFailure {
  field: string;
  expected: any;
  actual: any;
  threshold?: number;
  reason: string;
}

export interface Diff {
  field: string;
  baseline: any;
  current: any;
  percentChange: number;
}

export function compareImages(
  baseline: Baseline['output'],
  current: ImageMetadata,
  thresholds: ComparisonThresholds
): ComparisonResult {
  const failures: ComparisonFailure[] = [];
  const diffs: Diff[] = [];

  // Dimension comparison
  if (baseline.dimensions && current.dimensions) {
    const widthDiff = Math.abs(baseline.dimensions.width - current.dimensions.width) /
                      baseline.dimensions.width;

    if (widthDiff > thresholds.dimensionsTolerance) {
      failures.push({
        field: 'dimensions.width',
        expected: baseline.dimensions.width,
        actual: current.dimensions.width,
        threshold: thresholds.dimensionsTolerance,
        reason: `Width changed by ${(widthDiff * 100).toFixed(1)}% (threshold: ${thresholds.dimensionsTolerance * 100}%)`,
      });
    }

    diffs.push({
      field: 'dimensions.width',
      baseline: baseline.dimensions.width,
      current: current.dimensions.width,
      percentChange: widthDiff * 100,
    });

    // Same for height...
  }

  // File size comparison
  const sizeDiff = Math.abs(baseline.fileSizeKB - current.fileSizeKB) / baseline.fileSizeKB;
  if (sizeDiff > thresholds.fileSizeTolerance) {
    failures.push({
      field: 'fileSizeKB',
      expected: baseline.fileSizeKB,
      actual: current.fileSizeKB,
      threshold: thresholds.fileSizeTolerance,
      reason: `File size changed by ${(sizeDiff * 100).toFixed(1)}% (threshold: ${thresholds.fileSizeTolerance * 100}%)`,
    });
  }

  diffs.push({
    field: 'fileSizeKB',
    baseline: baseline.fileSizeKB,
    current: current.fileSizeKB,
    percentChange: sizeDiff * 100,
  });

  // pHash comparison (Hamming distance)
  if (baseline.phash && current.phash) {
    const hammingDistance = calculateHammingDistance(baseline.phash, current.phash);

    if (hammingDistance > thresholds.phashMaxDistance) {
      failures.push({
        field: 'phash',
        expected: baseline.phash,
        actual: current.phash,
        threshold: thresholds.phashMaxDistance,
        reason: `Perceptual hash distance: ${hammingDistance} (threshold: ${thresholds.phashMaxDistance})`,
      });
    }

    diffs.push({
      field: 'phash',
      baseline: baseline.phash,
      current: current.phash,
      percentChange: hammingDistance,
    });
  }

  // MIME type comparison (exact match)
  if (thresholds.formatMatch && baseline.mimeType !== current.mimeType) {
    failures.push({
      field: 'mimeType',
      expected: baseline.mimeType,
      actual: current.mimeType,
      reason: 'MIME type mismatch',
    });
  }

  return {
    passed: failures.length === 0,
    failures,
    diffs,
  };
}

function calculateHammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

export function compareVideos(
  baseline: Baseline['output'],
  current: VideoMetadata,
  thresholds: ComparisonThresholds
): ComparisonResult {
  // Similar logic but for video properties
  // Compare: dimensions, duration, file size, thumbnail pHash
  // ...
}
```

### Step 2: Comparison Engine (1.5h)

```typescript
// __tests__/baselines/compareBaseline.ts

import { Baseline } from './types';
import { compareImages, compareVideos, ComparisonResult } from './utils/comparison';
import { extractImageMetadata } from './utils/imageMetadata';
import { extractVideoMetadata } from './utils/videoMetadata';
import fs from 'fs/promises';
import path from 'path';

interface CompareOptions {
  model?: string;
  operation?: string;
  all?: boolean;
}

interface ComparisonReport {
  baseline: Baseline;
  result: ComparisonResult;
  timestamp: string;
}

export async function compareBaselines(options: CompareOptions): Promise<ComparisonReport[]> {
  console.log('🔍 Starting baseline comparison...\n');

  const reports: ComparisonReport[] = [];

  // Load baselines from __baselines__ directory
  const baselines = await loadBaselines(options);

  console.log(`📋 Comparing ${baselines.length} baselines...\n`);

  for (const baseline of baselines) {
    console.log(`⚙️  Comparing: ${baseline.operation.service} → ${baseline.operation.name} (${baseline.operation.model})`);

    try {
      // Call current model with same inputs
      const currentOutput = await callOperation(baseline);

      // Extract metadata from new output
      const currentMetadata = await extractMetadata(currentOutput, baseline.operation.service);

      // Compare
      const result = compareOutputs(baseline, currentMetadata);

      // Report
      reports.push({
        baseline,
        result,
        timestamp: new Date().toISOString(),
      });

      if (result.passed) {
        console.log(`✅ PASSED: ${baseline.operation.model}`);
      } else {
        console.log(`❌ FAILED: ${baseline.operation.model} (${result.failures.length} failures)`);
        result.failures.forEach(f => console.log(`   - ${f.reason}`));
      }

      console.log();
    } catch (error) {
      console.error(`💥 ERROR: ${baseline.operation.model}`, error);
    }
  }

  // Print summary
  printSummary(reports);

  return reports;
}

async function loadBaselines(options: CompareOptions): Promise<Baseline[]> {
  const baselines: Baseline[] = [];
  const baselinesDir = '__baselines__';

  // Recursively find all .json files
  const files = await glob(`${baselinesDir}/**/*.json`);

  for (const file of files) {
    if (file.endsWith('metadata.json')) continue;

    const baseline: Baseline = JSON.parse(await fs.readFile(file, 'utf-8'));

    // Filter by options
    if (options.model && baseline.operation.model !== options.model) continue;
    if (options.operation && baseline.operation.name !== options.operation) continue;

    baselines.push(baseline);
  }

  return baselines;
}

async function callOperation(baseline: Baseline): Promise<any> {
  // Reconstruct full inputs (base64 were truncated in baseline)
  // Use stock test images from config
  const fullInputs = reconstructInputs(baseline.input);

  // Call service (same logic as captureBaseline.ts)
  // ...
}

function compareOutputs(baseline: Baseline, current: any): ComparisonResult {
  if (baseline.operation.service.includes('image')) {
    return compareImages(baseline.output, current, baseline.validationCriteria);
  } else if (baseline.operation.service.includes('video')) {
    return compareVideos(baseline.output, current, baseline.validationCriteria);
  }
  throw new Error(`Unknown service: ${baseline.operation.service}`);
}

function printSummary(reports: ComparisonReport[]): void {
  const passed = reports.filter(r => r.result.passed).length;
  const failed = reports.filter(r => !r.result.passed).length;

  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total:  ${reports.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log('═══════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⚠️  BREAKING CHANGES DETECTED!');
    console.log('Review failures above before deploying model upgrades.\n');
  }
}
```

### Step 3: Reporter (30min)

```typescript
// __tests__/baselines/reporter.ts

export function generateReport(reports: ComparisonReport[]): string {
  let markdown = '# Baseline Comparison Report\n\n';
  markdown += `**Generated:** ${new Date().toISOString()}\n\n`;

  // Summary table
  markdown += '## Summary\n\n';
  markdown += '| Model | Operation | Status | Failures |\n';
  markdown += '|-------|-----------|--------|----------|\n';

  reports.forEach(report => {
    const status = report.result.passed ? '✅ PASS' : '❌ FAIL';
    markdown += `| ${report.baseline.operation.model} | ${report.baseline.operation.name} | ${status} | ${report.result.failures.length} |\n`;
  });

  // Detailed failures
  const failures = reports.filter(r => !r.result.passed);
  if (failures.length > 0) {
    markdown += '\n## Failures\n\n';

    failures.forEach(report => {
      markdown += `### ${report.baseline.operation.model} - ${report.baseline.operation.name}\n\n`;

      report.result.failures.forEach(failure => {
        markdown += `- **${failure.field}**: ${failure.reason}\n`;
        markdown += `  - Expected: \`${failure.expected}\`\n`;
        markdown += `  - Actual: \`${failure.actual}\`\n`;
      });

      markdown += '\n';
    });
  }

  return markdown;
}
```

---

## Todo List

- [ ] Implement comparison utilities (dimensions, file size, pHash)
- [ ] Implement Hamming distance calculation
- [ ] Implement image comparison function
- [ ] Implement video comparison function
- [ ] Implement compareBaselines main logic
- [ ] Implement baseline loader
- [ ] Implement reporter markdown generator
- [ ] Add CLI command for comparison
- [ ] Test comparison with identical outputs (should pass)
- [ ] Test comparison with modified outputs (should fail)

---

## Success Criteria

- ✅ Comparison engine detects dimension changes > threshold
- ✅ Comparison engine detects file size changes > threshold
- ✅ Comparison engine detects pHash changes > threshold
- ✅ CLI command `npm run test:baseline:compare` works
- ✅ Markdown report generated with summary + failures
- ✅ Zero false positives on unchanged models

---

## Next Steps

After Phase 3: Proceed to Phase 4 - Regression Test Suite
