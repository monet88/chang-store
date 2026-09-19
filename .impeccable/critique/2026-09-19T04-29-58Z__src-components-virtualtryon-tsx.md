---
target: src/components/VirtualTryOn.tsx
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:F:\\CodeBase\\chang-store\\src\\components\\VirtualTryOn.tsx"
target_fingerprint: "sha256:77ee10b65524b90e8b8738adc5d7d43a21bf9db53c95ef82e6ff0437af482a66"
target_path: "F:\\CodeBase\\chang-store\\src\\components\\VirtualTryOn.tsx"
timestamp: 2026-09-19T04-29-58Z
slug: src-components-virtualtryon-tsx
---
# Impeccable Design Critique: VirtualTryOn (src/components/VirtualTryOn.tsx)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|:---:|---|
| 1 | Visibility of System Status | 1/4 | Skeletons report "Queued and waiting" before generation starts; failed batch items silently vanish from result grid; empty-state placeholder text sits 165px below the fold. |
| 2 | Match System / Real World | 2/4 | Technical parameters ("Source Item Type", "interleaved parts") instead of fashion curation primitives; leaked developer string `(wardrobe)` in prompt labels. |
| 3 | User Control and Freedom | 2/4 | Multi-person target marker cannot be nudged or positioned via keyboard; failed batch items cannot be retried individually without restarting session. |
| 4 | Consistency and Standards | 1/4 | Step 2 heading duplicated twice; Step 3 missing; primary CTA uses off-white (#f4f4f2) instead of brand amber; single/multi-person toggle text wraps awkwardly into two lines on desktop. |
| 5 | Error Prevention | 2/4 | Disabled "Generate" CTA provides no tooltip or checklist explaining why generation is blocked; non-3:4 image uploads cause letterbox coordinate drift for markers. |
| 6 | Recognition Rather Than Recall | 2/4 | No fashion presets (e.g. "Tucked", "Studio lighting", "Oversized silhouette"); requires users to remember prompt formulas. |
| 7 | Flexibility and Efficiency | 2/4 | Multi-model batch upload exists, but lacks bulk operations, keyboard-operable marker placement, and quick-retry loops. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Empty state sits below fold on 768px viewports; root 12px font shrinks buttons to 9px; tooltips aggressively wrap entire form containers. |
| 9 | Error Recovery | 1/4 | Generic top error banner lacks actionable guidance; failed batch items evaluate to empty array `[]` and disappear. |
| 10 | Help and Documentation | 2/4 | Form hints inflate panel height with mismatched typography (`text-base leading-7` vs 9px inputs); focus triggers intrusive tooltips. |
| **Total** | | **17/40** | **Poor / High Attention Required (42.5%)** |

---

## Design Specificity Verdict

- **LLM Assessment**: VirtualTryOn currently behaves as an engineering parameter form rather than an editorial fashion studio workbench. While PRODUCT.md mandates a "studio-grade, calm, deliberate" space for high-end fashion e-commerce and creators, the UI relies on nested rectangular cards (`bg-white/[0.04]`), uppercase tracked section labels, and raw textareas.
- **Deterministic Scan**: CLI scan reported 0 findings on `VirtualTryOn.tsx`. A cluster scan flagged 1 warning on `src/components/Spinner.tsx` (`border-accent-on-rounded` on line 18 `border-b-2`), which was confirmed as a **False Positive** (a standard 2px single-edge animated spinner arc, identical to an existing exception already logged in `.impeccable/config.json`).
- **Browser & Runtime Evidence**: Headless Chromium measurements on port 3549 revealed 14 concrete UX and accessibility defects:
  1. The results panel stretch (`align-items: stretch`) pushes empty-state copy to 933px (165px below the fold on standard 768px viewports).
  2. Mode and multi-person toggles lack `aria-pressed` / `aria-checked` states (selection is color-only).
  3. The multi-person marker overlay `#multi-person-overlay` is mouse-only (`cursor-crosshair`) with no keyboard or focus accessibility.
  4. Active toggle keyboard focus ring has a 1.16:1 contrast ratio against the backdrop (failing WCAG 1.4.11 >= 3:1).
  5. The range slider has a 6px target height with zero visible focus indicator.
  6. Clothing item deletion button has an empty accessible name (missing `aria-label`).
  7. Root font-size of 12px causes `text-xs` buttons and body copy to render at 9px.

---

## Overall Impression

VirtualTryOn has solid core domain capabilities (multi-model and wardrobe modes, inline refinement, model provenance badging), but its UI hierarchy, accessibility, and feedback states fall short of the promised "studio-grade, calm, deliberate" benchmark. The surface suffers from premature skeleton loading, silent item vanishing on error, and severe accessibility barriers for keyboard and touch users.

---

## What's Working

1. **Dual Workflow Architecture**: Clean conceptual separation between 1-outfit-to-N-models and N-outfits-to-1-model matches genuine fashion e-commerce workflows.
2. **Inline Refinement Drawer**: Per-card prompt refinement allows rapid iterative tuning without wiping form inputs.
3. **Model Provenance Badging**: Source model thumbnail pills (`#1`, `#2`) provide clear traceability from input to generated output.

---

## Priority Issues (P0–P3)

### [P1] Silent Vanishing of Failed Batch Items & Premature Loading Skeletons
- **Why it matters**: Skeletons saying "Queued and waiting to start" appear immediately upon model image upload (before garments are uploaded or Generate is clicked), misleading users. When a batch item fails during generation, `status === 'error'` evaluates to `[]` and vanishes completely from the result grid without an error card or retry button.
- **Fix**: Gate skeleton rendering behind active generation (`isAnyGenerating`), and render a dedicated error card with failure reason and a single-item retry button when `item.status === 'error'`.
- **Suggested command**: `$impeccable harden src/components/VirtualTryOn.tsx`

### [P1] Multi-Person Marker Coordinate Distortion on Non-3:4 Aspect Ratios
- **Why it matters**: The crosshair overlay covers an `aspect-[3/4]` container while the image uses `object-contain`. When users upload square (1:1), landscape (16:9), or tall (9:16) photos, click coordinates drift into the letterboxed margin, placing the target marker on the wrong person or empty background.
- **Fix**: Clamp click coordinates to the rendered image bounds or calculate offsets excluding letterbox padding.
- **Suggested command**: `$impeccable polish src/components/VirtualTryOn.tsx`

### [P2] Broken Step Progression & Typographic Inversion
- **Why it matters**: `{t('virtualTryOn.step2')}` is rendered twice (above Source Items and on the Styling Inputs panel), while Step 3 is omitted. Explanatory hint copy uses `text-base leading-7 text-zinc-400`, rendering larger and visually heavier than the primary buttons (9px) and form inputs.
- **Fix**: Label garment section as "Source Garments", keep Step 2 for Styling Inputs, label CTA as Step 3, and standardize hint copy to `text-xs leading-5 text-zinc-400`.
- **Suggested command**: `$impeccable layout src/components/VirtualTryOn.tsx`

### [P2] Brand Accent Disconnect & Leaked Developer Strings
- **Why it matters**: The primary CTA uses an off-white button (`bg-[#f4f4f2] text-[#09090b]`) instead of the brand amber ramp (`--brand-gradient`), contradicting PRODUCT.md and DESIGN.md. In Wardrobe mode, prompt labels expose unformatted strings (`Background (wardrobe)`).
- **Fix**: Standardize primary CTA to `brand-button` utility or amber gradient, and normalize wardrobe localization keys.
- **Suggested command**: `$impeccable colorize src/components/VirtualTryOn.tsx`

### [P2] Critical Accessibility Flaws (WCAG 2.1 AA)
- **Why it matters**: Clothing item delete button is hidden behind `opacity-0 group-hover:opacity-100` with no touch affordance, no `aria-label`, and a 23px target size. Multi-person marker has no keyboard controls. Mode toggles convey selection by color alone.
- **Fix**: Add `aria-label={t('common.remove')}`, ensure touch visibility, add `aria-pressed` to mode toggles, and provide keyboard control for person selection.
- **Suggested command**: `$impeccable harden src/components/VirtualTryOn.tsx`

---

## Persona Red Flags

- **Alex (Fashion E-commerce Studio Lead)**: Uploads 6 model photos and sees "0/6 completed · Queued and waiting" before uploading garments. When model #4 fails a moderation filter, it vanishes from the grid. Alex sees "5/6 completed · 1 failed" but cannot identify which model failed or retry it without restarting the whole batch.
- **Jordan (First-Time Content Creator)**: Uploads a 16:9 group photo in multi-person mode. The letterbox causes the crosshair marker to click onto the background wall instead of their friend. The composite places garments onto empty space.
- **Minh (Individual Shopper on iPad)**: Attempts to delete an extra garment slot. On iPad, hover states do not exist, so the delete button remains hidden (`opacity-0`). Minh is stuck with an invalid empty slot that blocks generation.

---

## Minor Observations

1. **Empty State Off-Screen**: The results panel stretching pushes the "Your results will appear here" placeholder 165px below the fold on standard 768px displays.
2. **Pill Text Wrap on Desktop**: The single/multi-person toggle wraps "Một chủ thể" into two lines at 1365px due to missing `shrink-0 whitespace-nowrap`.
3. **Hardcoded Max Width in Wardrobe**: `WardrobeSetCard.tsx` uses `max-w-[50%]` on the items grid, unnaturally cramping inputs into narrow columns.
4. **Range Slider Hit Area**: Number of images slider has a 6px target band and zero focus outline.

---

## Questions to Consider

- What if the virtual try-on workflow abandoned raw textareas and adopted visual garment silhouette chips (top, bottom, outer, footwear) with auto-segmentation?
- What if multi-person selection used an interactive face/person picker with automatic bounding box detection instead of a manual crosshair click?
- How might the results stage feel like an active photo review lightbox rather than a static card list?
