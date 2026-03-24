---
phase: 01
slug: multi-image-session-foundation
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- useUpscale` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- useUpscale`
- **After every plan wave:** Run `npm run test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | UPS-01, UPS-05 | hook/unit | `npm run test -- useUpscale` | `__tests__/hooks/useUpscale.test.tsx` | ⬜ pending |
| 01-01-02 | 01 | 1 | UPS-03, UPS-04 | component/integration | `npm run test -- Upscale` | `__tests__/components/Upscale.test.tsx` | ⬜ pending |
| 01-01-03 | 01 | 1 | UPS-01, UPS-03, UPS-04, UPS-05 | build/regression | `npm run build` | `components/Upscale.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.
- No new framework install or global test harness work is required before execution.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sticky desktop result panel stays visible while controls scroll | UPS-03, UPS-04 | Layout quality and sticky behavior are visual/browser-dependent | Run the app, open Upscale on desktop width, upload multiple images, and confirm the right panel stays pinned while using mode and step controls |
| Mobile layout keeps image rail, mode switch, and step shell understandable without overlap | UPS-01, UPS-03 | Responsive spacing and perceived clarity are visual | Run the app in a narrow viewport and confirm the session rail, segmented switch, and AI Studio steps remain readable and actionable |

---

## Validation Sign-Off

- [x] All tasks have automated verify coverage or existing infra support
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-16
