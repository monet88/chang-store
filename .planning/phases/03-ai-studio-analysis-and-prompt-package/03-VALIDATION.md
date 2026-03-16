---
phase: 3
slug: ai-studio-analysis-and-prompt-package
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 3 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --reporter=verbose --run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --reporter=verbose --run`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ANL-01, ANL-02 | unit | `npm run test -- --run __tests__/services/upscaleAnalysisService.test.ts` | ? W0 | ○ pending |
| 03-01-02 | 01 | 1 | PRM-01, PRM-02, PRM-03 | unit | `npm run test -- --run __tests__/services/upscaleAnalysisService.test.ts` | ? W0 | ○ pending |
| 03-01-03 | 01 | 2 | ANL-01, ANL-02 | unit | `npm run test -- --run __tests__/hooks/useUpscale.test.tsx` | ✓ exists | ○ pending |
| 03-01-04 | 01 | 2 | PRM-03 | unit | `npm run test -- --run __tests__/hooks/useUpscale.test.tsx` | ✓ exists | ○ pending |
| 03-01-05 | 01 | 3 | ANL-01, ANL-02, PRM-01 | component | `npm run test -- --run __tests__/components/UpscaleAnalyzeStep.test.tsx` | ? W0 | ○ pending |

*Status: ○ pending ✓ green ✗ red ⚡ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/services/upscaleAnalysisService.test.ts` — stubs for ANL-01, ANL-02, PRM-01, PRM-02, PRM-03
- [ ] `__tests__/components/UpscaleAnalyzeStep.test.tsx` — render test stubs

*Existing infrastructure covers hooks testing — `__tests__/hooks/useUpscale.test.tsx` already exists.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual report layout | ANL-01 | CSS/visual rendering | Open AI Studio → upload image → generate analysis → verify 6 collapsible sections displayed |
| Preservation risk badges | ANL-02 | Visual styling | Verify risk items have colored badges (red=high, yellow=medium, green=low) |
| Copy button clipboard | PRM-01 | Browser API | Click copy button → paste elsewhere → verify prompt text matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
