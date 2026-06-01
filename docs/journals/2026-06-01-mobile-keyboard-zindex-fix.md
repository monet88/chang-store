# Mobile Keyboard Clobbers UI: z-index Topsy-Turvy and 100vh Betrayal

**Date**: 2026-06-01 12:06
**Severity**: High
**Component**: Global layout (Header, UtilityDock, App shell, viewport config)
**Status**: Resolved

## What Happened

On mobile devices the UI broke in two distinct ways. First, opening the sidebar showed the backdrop overlay on top of the drawer itself -- the sidebar was invisible behind a semi-transparent black sheet. Second, when the virtual keyboard appeared, the entire layout would compress, hiding the UtilityDock behind the keyboard and clipping the bottom of the main content area. Two separate root causes, both in global layout primitives.

## The Brutal Truth

This is the kind of bug that makes you look sloppy on a phone demo. The sidebar rendering invisible behind its own overlay is a straight-up z-index ordering mistake -- someone (probably me) slotting a new component at the wrong layer. The keyboard viewport thing is a classic "works on desktop, ships broken on mobile" that happens when you treat `100vh` as a real thing. Both are embarrassingly basic. The real frustration is that the semantic token table in the design guidelines didn't exist, so there was no single source of truth to catch the inversion during review.

## Technical Details

**Bug 1 -- z-index inversion:**
- `Header` (sidebar drawer) used `z-sticky` which maps to `--z-index-sticky: 1100`
- `MobileOverlay` used `z-overlay` which maps to `--z-index-overlay: 1200`
- Result: overlay renders ON TOP of the drawer. Tapping to open produces a black sheet with nothing visible underneath.
- Fix: introduced `--z-index-sidebar: 1250` (between overlay at 1200 and modal-backdrop at 1300), plus `@utility z-sidebar { z-index: var(--z-index-sidebar); }`. Header switched from `z-sticky` to `z-sidebar`.

**Bug 2 -- mobile keyboard viewport clipping:**
- `src/App.tsx` used `min-h-screen` on two containers, which maps to `100vh`. Mobile browsers treat `100vh` as the full screen height including browser chrome, so when the keyboard opens, the visible area shrinks but the layout still thinks it has 100vh. Bottom-anchored elements get pushed below the fold.
- `src/components/UtilityDock.tsx` used `bottom-4` (a fixed `1rem` offset). No safe-area awareness.
- Fix: `min-h-screen` -> `min-h-dvh` (dynamic viewport height, recalculated when the keyboard toggles). UtilityDock: `bottom-[calc(1rem+env(safe-area-inset-bottom))]`.
- `index.html`: added `viewport-fit=cover` and `interactive-widget=resizes-content` to the viewport meta tag.

**Files touched (7):** `src/index.css`, `src/App.tsx`, `src/components/Header.tsx`, `src/components/UtilityDock.tsx`, `index.html`, `__tests__/components/Header.test.tsx`, `__tests__/components/UtilityDock.test.tsx`, `docs/design-guidelines.md`.

**Validation:** `npx tsc --noEmit` (pass), `npm run lint` (pass), `npm run test` (66 files, 696 tests -- pass), `npm run build` (pass).

## What We Tried

The initial fix for the keyboard issue was just swapping `min-h-screen` to `min-h-dvh` in `App.tsx`. That fixed the main content area but the UtilityDock still sat at a hardcoded bottom offset. Had to go back and add the safe-area calculation. The z-index fix was straightforward once we checked the token values -- the inversion was obvious in retrospect.

## Root Cause Analysis

Two distinct failures:

1. **No canonical z-index reference.** The token values existed in `src/index.css` as CSS custom properties but there was no documentation table explaining their ordering. When `Header` needed a z-index, `z-sticky` sounded roughly right, and nobody noticed it sat below `z-overlay`. A documented layer scale would have caught this during code review.

2. **Desktop-first assumption in viewport strategy.** Three separate things all assumed a desktop viewport: `100vh` for full-height containers, hardcoded `bottom-4` for the utility dock, and the minimal viewport meta tag. Mobile keyboard support requires coordinated changes across all three -- fixing just one leaves a broken experience.

## Lessons Learned

**Semantic token changes require a four-part update: the variable, the utility class, the component usage, and the documentation.** Just adding `--z-index-sidebar: 1250` in `index.css` is not enough. You need the `@utility z-sidebar` so Tailwind is wired, you need to update the consuming component, and you need the documentation table so the next person doesn't put themselves in the same hole. The z-index inversion was a documentation gap as much as a code gap.

**Mobile layout is a multi-property problem.** You cannot fix keyboard viewport issues with just `min-h-dvh` or just `interactive-widget=resizes-content` or just safe-area padding. The fix requires: the viewport meta tag, the dvh units on the layout containers, _and_ safe-area-aware positioning on any bottom-anchored element.

**Tests need behavioral assertions for z-index, not just existence.** The test we added checks `toHaveClass('z-sidebar')`, which is better than nothing, but it does not verify the actual computed z-order. A true regression test would render both the overlay and the sidebar and verify that one is painted above the other. Our utility-based approach makes the class check reasonable, but it's worth acknowledging the gap.

## Next Steps

- No further work needed on this specific fix -- validated on all four gates.
- Audit remaining `min-h-screen` and `100vh` usages in the codebase for mobile correctness (did not find any during the fix, but a grep would be cheap insurance).
- The z-index table added to `docs/design-guidelines.md` should be referenced in the code review checklist (`docs/code-standards.md` or equivalent) so future z-index additions go through the documented scale.
