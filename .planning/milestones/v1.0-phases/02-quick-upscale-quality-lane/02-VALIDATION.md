---
phase: 2
slug: quick-upscale-quality-lane
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --reporter=dot` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --reporter=dot`
- **After every plan wave:** Run `npm run test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | UPS-02 | unit | `npm run test -- useUpscale` | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | UPS-06 | unit | `npm run test -- imageEditingService` | ✅ | ✅ green |
| 02-01-03 | 01 | 1 | UPS-02 | unit | `npm run test -- UpscaleQuickPanel` | ✅ | ✅ green |
| 02-01-04 | 01 | 1 | UPS-02 | unit | `npm run test -- ImageComparator` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Vitest already configured with 443+ passing tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glow/flash animation on result ready | UPS-02 | Visual animation timing | 1. Run upscale 2. Observe output panel glow/flash when result appears |
| Slider comparison UX | UPS-02 | Visual interaction | 1. Upload image 2. Run Quick Upscale 3. Drag slider to compare |
| Confirmation dialog before re-upscale | UPS-02 | UI interaction flow | 1. Run upscale 2. Click re-upscale 3. Confirm dialog appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
