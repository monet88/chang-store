---
title: "Model Upgrade Regression Testing"
description: "Add regression tests to detect breaking changes when AI model versions are upgraded"
status: pending
priority: P2
effort: 16h
tags: [testing, regression, ai-models, quality-assurance]
created: 2026-01-04
---

# Model Upgrade Regression Testing Plan

## Overview

Implement regression testing framework to detect breaking changes when Gemini or AIVideoAuto model versions are upgraded. Ensures consistent output quality and API compatibility across model updates.

**Context:**
- Current: 447/447 tests passing (100%), all mocked
- Dual AI backends: Gemini (Google) + AIVideoAuto
- 14 features using these models
- No existing regression tests for model outputs

**Goal:** Add automated tests that validate model upgrades don't break functionality or degrade output quality.

---

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Research & Design | Pending | 4h | [phase-01](./phase-01-research-design.md) |
| 2 | Baseline Capture System | Pending | 4h | [phase-02-baseline-capture.md) |
| 3 | Comparison Engine | Pending | 3h | [phase-03-comparison-engine.md) |
| 4 | Regression Test Suite | Pending | 3h | [phase-04-regression-tests.md) |
| 5 | CI/CD Integration | Pending | 2h | [phase-05-ci-cd-integration.md) |

**Total:** 16h

---

## Key Design Decisions

### 1. Test Strategy: Snapshot + Validation

**Approach:**
- Capture baseline outputs (snapshots) for critical operations
- Compare new model outputs against baselines
- Validate critical properties (dimensions, format, safety)

**Rationale:**
- AI outputs are non-deterministic → exact match impossible
- Focus on structural consistency + quality metrics
- Alert on significant deviations (breaking changes)

### 2. Two-Tier Testing

**Unit Tests (Existing):**
- Mock all API calls
- Test business logic + error handling
- Fast, deterministic, run on every commit

**Regression Tests (New):**
- Real API calls with baselines
- Detect model behavior changes
- Run on-demand or on model upgrade

### 3. Baseline Storage

**Structure:**
```
__baselines__/
├── gemini/
│   ├── image-edit-gemini-3-flash.json
│   ├── image-generate-imagen-4.json
│   └── video-generate-veo-2.json
├── aivideoauto/
│   ├── image-edit-model-x.json
│   └── video-generate-model-y.json
└── metadata.json  # Model versions + timestamps
```

**Format:**
```json
{
  "modelVersion": "gemini-3-flash-preview",
  "capturedAt": "2026-01-04T20:49:00Z",
  "operations": {
    "editImage": {
      "input": { "prompt": "...", "aspectRatio": "1:1" },
      "output": {
        "mimeType": "image/png",
        "dimensions": { "width": 1024, "height": 1024 },
        "fileSizeKB": 245,
        "base64Sample": "first 100 chars..."  // For visual inspection
      },
      "validationCriteria": {
        "dimensionsTolerance": 0.1,  // ±10%
        "formatMatch": true,
        "safetyPass": true
      }
    }
  }
}
```

---

## Dependencies

### External
- Gemini API access (`GEMINI_API_KEY`)
- AIVideoAuto API access (test account)
- CI/CD runner quota for API calls

### Internal
- Existing test infrastructure (Vitest)
- API service layer (`services/`)
- Type definitions (`types.ts`)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| API quota exhaustion | High | Rate limiting, baseline caching |
| Flaky tests (non-deterministic outputs) | Medium | Flexible comparison thresholds |
| Baseline drift over time | Medium | Periodic baseline refresh workflow |
| Cost of API calls in CI | Medium | Run only on model upgrade triggers |

---

## Success Criteria

- ✅ Baseline capture system for all 5 critical operations
- ✅ Comparison engine with configurable thresholds
- ✅ 10+ regression tests covering critical paths
- ✅ CI/CD integration with manual trigger
- ✅ Documentation for baseline refresh workflow
- ✅ Zero false positives in initial validation

---

## Related Documentation

- [Testing Guide](../../docs/testing-guide.md) - Unit testing patterns
- [Codebase Summary](../../docs/codebase-summary.md) - Architecture
- [Code Standards](../../docs/code-standards.md) - Quality guidelines

---

## Notes

- Baselines must be refreshed when models are intentionally upgraded
- Regression tests are **opt-in** (not part of default test suite)
- Focus on **breaking changes**, not minor variations
- Use environment variables to enable/disable regression tests
