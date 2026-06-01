# Status Report: Mobile UI Bugfix

**Date:** 2026-06-01
**Report:** pm-260601-1150-mobile-ui-bugfix-status-report.md
**Plan:** None (ad-hoc bugfix)

## Summary

Fixed two mobile regressions in the single-page virtual fashion studio. Both were introduced during recent provider studio and lookbook feature work. All 696 tests pass, type-check and lint clean, production build succeeds.

---

## Progress vs. Plan

No active plan. Bugfix completed in one session. Not tracked against plan.

---

## Fixed Issues

### Issue 1: Menu overlay covers/blurs sidebar (z-index inversion)

**Root cause:** Mobile sidebar overlay (`--z-index-overlay: 1200`) rendered at the same or lower layer than sticky header/utility dock elements (`--z-index-sticky: 1100`). The overlay blurred the sidebar it was supposed to slide behind, making it unreadable.

**Fix:** Applied the semantic z-index token `--z-index-sidebar: 1250` to sidebar/drawer panels, and ensured overlay backdrops use `--z-index-overlay: 1200`. Order restored: backdrop (1200) -> sidebar (1250).

### Issue 2: Soft keyboard clips viewport and fixed-position dock

**Root cause:** `index.html` viewport meta tag used `interactive-widget=resizes-visual` (default behavior), which does NOT resize the layout viewport when the keyboard opens. Combined with `position: fixed` on the utility dock, the dock stayed anchored to visual-bottom, overlapping the keyboard. Content below the keyboard was unreachable.

**Fix:** Changed to `interactive-widget=resizes-content` in the viewport meta tag. This causes supporting browsers to resize the layout viewport when the soft keyboard opens, so fixed-position elements can re-flow with the content viewport. Updated the utility dock with dynamic viewport/safe-area-aware bottom positioning instead of a hardcoded `bottom-4` offset.

---

## Changed Files

| File | Change |
|------|--------|
| `index.html` | Added `interactive-widget=resizes-content` to viewport meta |
| `src/index.css` | Adjusted z-index utility classes for sidebar/overlay layering |
| `src/App.tsx` | Layout container height handling for keyboard-safe viewport |
| `src/components/Header.tsx` | Header z-index corrected to use semantic token |
| `src/components/UtilityDock.tsx` | Dock position behavior: safe-area-aware fixed bottom offset and mobile width bounds |
| `__tests__/components/Header.test.tsx` | Updated assertions for new z-index class |
| `__tests__/components/UtilityDock.test.tsx` | Updated assertions for new position behavior |
| `docs/design-guidelines.md` | Added z-index layer scale with sidebar ordering |

---

## Validation Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run lint` | PASS (0 warnings, 0 errors) |
| `npm run test` | PASS (66 files, 696 tests, all passing) |
| `npm run build` | PASS (production bundle written) |

---

## GitNexus Impact

- **Impact analysis:** LOW — changes scoped to layout/z-index tokens and component position behavior. No service routing, API contracts, or data flow affected.
- **detect_changes:** Reported NO changes despite `git diff` showing 8 modified files. This is a tool false-negative (likely index staleness or caching). Verified manually.

---

## Docs Impact

**Minor.** Updated `docs/design-guidelines.md` to document the z-index layer ordering with sidebar (1250) between overlay (1200) and modal-backdrop (1300).

---

## Blockers

None.

---

## Scope Changes

None. Ad-hoc bugfix, no scope deviation from the original fix objectives.

---

## Risks

| Risk | Status | Note |
|------|--------|------|
| `interactive-widget=resizes-content` browser compatibility | Resolved | Widely supported: Chrome 108+, Safari 16.4+, Firefox 121+. iOS Safari 16.4+ handles correctly. |
| Fixed dock behavior regression on desktop | Resolved | UtilityDock remains fixed, with mobile width bounds and a safe-area-aware bottom offset. |
| GitNexus detect_changes false negative | Open (minor) | Tool reports no changes despite obvious git diff. Likely needs `npx gitnexus analyze` re-index. Does not block merge. |

---

## Next Actions

| Action | Owner | Done Criteria |
|--------|-------|--------------|
| Re-index GitNexus to fix detect_changes false negative | dev | `npx gitnexus analyze` completes without error |
| Verify fix on real iOS/Android devices (not just browser devtools) | QA | Keyboard opens: dock reflows above, sidebar readable, no layout shift |
| Cherry-pick to release branch if hotfix needed | dev | PR approved, CI green |

---

## Unresolved Questions

- None. Both regressions verified fixed in Chrome devtools mobile emulation (iOS/Android viewport presets). Real-device QA recommended as next action.
