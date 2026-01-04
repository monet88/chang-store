# Phase 1: Research & Design

**Status:** Pending
**Priority:** P2
**Effort:** 4h

---

## Context Links

- [Plan Overview](./plan.md)
- [Testing Guide](../../docs/testing-guide.md)
- [Gemini Image Service](../../services/gemini/image.ts)
- [AIVideoAuto Service](../../services/aivideoautoService.ts)

---

## Overview

Research regression testing approaches for AI models and design baseline comparison system. Define what constitutes a "breaking change" for each operation type.

---

## Key Research Questions

### 1. AI Output Determinism
- **Question:** How consistent are Gemini/AIVideoAuto outputs for identical inputs?
- **Method:** Run same prompt 10x, measure variance
- **Expected:** Some variation, need tolerance thresholds

### 2. Model Version Detection
- **Question:** Can we programmatically detect model version changes?
- **Method:** Check API response headers, SDK version introspection
- **Expected:** Gemini SDK may expose version, AIVideoAuto via API response

### 3. Baseline Comparison Strategies
- **Research:** Existing tools/libraries for image comparison
- **Options:**
  - Pixel-perfect diff (too strict)
  - Perceptual hash (pHash) - structural similarity
  - ML-based quality metrics (SSIM, PSNR)
  - Metadata comparison (dimensions, format, file size)
- **Recommendation:** Metadata + perceptual hash hybrid

### 4. Video Comparison
- **Challenges:** Large file sizes, frame-by-frame analysis
- **Options:**
  - Thumbnail comparison (first/middle/last frames)
  - Duration + resolution validation
  - File size variance check (±20%)
- **Recommendation:** Thumbnail pHash + metadata

---

## Design Decisions

### Critical Operations (Priority Order)

| Operation | Service | Models | Baseline Priority |
|-----------|---------|--------|-------------------|
| `editImage` | gemini/image | gemini-3-flash, imagen-4 | **P0** - Most used |
| `generateImage` | gemini/image | imagen-4 | **P1** |
| `upscaleImage` | gemini/image | gemini-3-pro | **P1** |
| `generateVideo` | gemini/video | veo-2 | **P2** - Expensive |
| `createImage` (AIVideoAuto) | aivideoauto | various | **P1** |

### Baseline Capture Triggers

**Manual:**
```bash
npm run test:baseline:capture -- --model=gemini-3-flash
```

**Automated:**
- On scheduled CI job (weekly)
- Before/after known model upgrades

### Comparison Thresholds

```typescript
interface ComparisonThresholds {
  // Image dimensions tolerance (±10%)
  dimensionsTolerance: 0.1;

  // File size variance (±30% - compression varies)
  fileSizeTolerance: 0.3;

  // Perceptual hash distance (Hamming distance < 10)
  phashMaxDistance: 10;

  // Format must match exactly
  formatMatch: true;

  // Safety filters must pass
  safetyPass: true;
}
```

### Baseline Versioning

```typescript
interface BaselineMetadata {
  modelVersion: string;       // "gemini-3-flash-preview"
  capturedAt: string;         // ISO timestamp
  capturedBy: string;         // "ci" | "manual"
  sdkVersion: string;         // "@google/genai@1.2.3"
  environmentHash: string;    // Git commit SHA
  validUntil?: string;        // Optional expiry
}
```

---

## Architecture

### Directory Structure

```
__baselines__/                    # Git-tracked baseline repository
├── gemini/
│   ├── image/
│   │   ├── edit-gemini-3-flash.json
│   │   ├── edit-gemini-3-pro.json
│   │   ├── generate-imagen-4.json
│   │   └── upscale-gemini-3-pro.json
│   ├── video/
│   │   └── generate-veo-2.json
│   └── text/
│       └── generate-gemini-3-flash.json
├── aivideoauto/
│   ├── image/
│   │   └── edit-model-x.json
│   └── video/
│       └── generate-model-y.json
├── metadata.json                 # Global metadata
└── README.md                     # Baseline refresh guide
```

### Baseline File Schema

```typescript
interface Baseline {
  metadata: BaselineMetadata;
  operation: {
    name: string;              // "editImage"
    service: string;           // "gemini/image"
    model: string;             // "gemini-3-flash-preview"
  };
  input: {
    prompt: string;
    images?: string[];         // Base64 samples (first 100 chars)
    aspectRatio?: string;
    resolution?: string;
    [key: string]: any;        // Additional params
  };
  output: {
    mimeType: string;
    dimensions?: {
      width: number;
      height: number;
    };
    fileSizeKB: number;
    durationSeconds?: number;  // For video
    phash?: string;            // Perceptual hash
    base64Sample: string;      // First 100 chars for inspection
  };
  validationCriteria: ComparisonThresholds;
}
```

---

## Implementation Steps

### Step 1: Research Phase (2h)

1. **Test Output Consistency**
   - Run 10 identical prompts with gemini-3-flash
   - Measure variance in dimensions, file size, pHash
   - Document findings in `research/consistency-analysis.md`

2. **Evaluate Comparison Libraries**
   - Test `pHash` library: `npm install phash`
   - Test `sharp` for image metadata extraction
   - Test `ffprobe` for video metadata
   - Document performance benchmarks

3. **Model Version Detection**
   - Inspect Gemini SDK response structure
   - Check for version headers/metadata
   - Test AIVideoAuto API response
   - Document detection methods

### Step 2: Design Phase (2h)

4. **Define Baseline Schema**
   - Create TypeScript types in `__tests__/baselines/types.ts`
   - Validate with sample baseline file
   - Add JSON schema for validation

5. **Design Comparison Algorithm**
   - Pseudocode for image comparison
   - Pseudocode for video comparison
   - Define pass/fail criteria
   - Edge case handling (missing baselines, format changes)

6. **Design Baseline Refresh Workflow**
   - CLI command design
   - Git workflow (PR for baseline updates)
   - Approval process
   - Documentation template

---

## Todo List

Research Tasks:
- [ ] Run consistency experiment (10x same prompt)
- [ ] Measure pHash variance across runs
- [ ] Test sharp library for metadata extraction
- [ ] Test ffprobe for video metadata
- [ ] Inspect Gemini API response for version info
- [ ] Inspect AIVideoAuto API response structure
- [ ] Document findings in research report

Design Tasks:
- [ ] Create baseline TypeScript types
- [ ] Design comparison algorithm pseudocode
- [ ] Define thresholds per operation type
- [ ] Design baseline refresh CLI command
- [ ] Write baseline refresh guide template
- [ ] Create sample baseline file for validation

---

## Deliverables

1. **Research Report** (`research/consistency-analysis.md`)
   - Output variance measurements
   - Library evaluation results
   - Version detection findings

2. **Type Definitions** (`__tests__/baselines/types.ts`)
   - `Baseline` interface
   - `ComparisonThresholds` interface
   - `BaselineMetadata` interface

3. **Design Document** (this file updated)
   - Comparison algorithm pseudocode
   - Baseline refresh workflow
   - Sample baseline file

---

## Success Criteria

- ✅ Documented output variance for gemini-3-flash (n=10)
- ✅ Comparison library selected with benchmarks
- ✅ Model version detection method identified
- ✅ Complete TypeScript type definitions
- ✅ Baseline refresh workflow documented
- ✅ Sample baseline file validates against schema

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| High output variance → unreliable tests | High | Set generous thresholds, focus on critical changes |
| No version detection → manual tracking | Medium | Use SDK version + timestamp as proxy |
| pHash library performance issues | Low | Fallback to metadata-only comparison |

---

## Security Considerations

- **API Keys:** Use test API keys with quota limits
- **Baseline Data:** Review for sensitive prompts before commit
- **Git LFS:** Consider for large baseline files (>1MB)

---

## Next Steps

After Phase 1 completion:
1. Review research findings with team
2. Approve comparison thresholds
3. Proceed to Phase 2: Baseline Capture System
