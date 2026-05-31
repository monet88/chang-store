---
phase: 2
title: "Stepped Visual Parity"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Stepped Visual Parity

## Overview

Restructure the provider studio layout to match Gemini's stepped, card-based visual
language: rounded panels, "Step 1 / Step 2" headings, section titles, and consistent
spacing — across all five workflows. This is the highest-visual-impact, lowest-risk
phase and matches the reference screenshots.

## Requirements

- Functional: each provider workflow renders as labeled stepped sections (Upload →
  Customize → Generate) instead of one flat scroll.
- Non-functional: reuse Gemini's Tailwind class vocabulary so the look matches exactly;
  no inline styles; Tailwind only (per AGENTS.md).

## Architecture

Gemini uses a shared class set (from `VirtualTryOn.tsx`):
- `panelClass = 'rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8'`
- `labelClass`, `sectionTitleClass`, `helperClass`, button classes, `textareaClass`.

Plan:
- Create `src/components/studios/provider-studio/provider-studio-styles.ts` exporting the
  shared class constants (single source, DRY) — mirrors Gemini's values.
- In `ProviderStudioShell`, wrap each logical group in a `panelClass` panel with a
  `sectionTitleClass` heading and step eyebrow text (e.g. "STEP 1 · UPLOAD").
- Add a small `StepPanel` presentational helper (`{ step, title, hint, children }`) to
  avoid repeating the eyebrow/title markup.
- Map workflow → ordered steps using the existing `ProviderWorkflowConfig` flags
  (settings is always step 0/aside; upload = step 1; customize = step 2 when any
  source/background/extra/lookbook field is active; generate = final).

## Related Code Files

- Create: `src/components/studios/provider-studio/provider-studio-styles.ts`
- Create: `src/components/studios/provider-studio/StepPanel.tsx`
- Modify: `src/components/studios/provider-studio/ProviderStudioShell.tsx`
- Modify: `src/components/studios/provider-studio/ProviderSettingsPanel.tsx` (adopt shared panel class)
- Read: `src/components/VirtualTryOn.tsx` (class vocabulary reference)

## Implementation Steps

1. Extract Gemini's panel/label/title/button/textarea class constants into
   `provider-studio-styles.ts`.
2. Build `StepPanel` (eyebrow + title + optional hint + children) using those classes.
3. Wrap the shell's groups: Settings (aside), Step 1 Upload, Step 2 Customize
   (conditional on workflow flags), prompt + options + Generate as the final panel.
4. Apply shared classes to `ProviderSettingsPanel` so it visually matches.
5. Verify each of the 5 workflows renders correct step labels (Pattern Generator has
   no customize step; Try-On/Clothing Transfer do).
6. Manual visual pass vs Gemini screenshots; run lint + tsc.

## Success Criteria

- [ ] All 5 provider workflows render as stepped, rounded-card panels matching Gemini.
- [ ] Shared style constants used (no ad-hoc class drift).
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] No layout regression in results column.

## Risk Assessment

- Risk: visual mismatch with Gemini. Mitigation: copy exact class constants, side-by-side
  compare with screenshots.
- Risk: step logic wrong for a workflow. Mitigation: drive steps off existing workflow
  config flags, test all five.
