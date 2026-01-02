# Typography Scale Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize typography across all components using a 4-tier responsive scale.

**Architecture:** Replace ad-hoc font sizes with consistent typography roles (Page Title, Section Title, Body, Caption). Apply mobile-first responsive sizing for titles.

**Tech Stack:** Tailwind CSS classes only, no additional CSS.

---

## Typography Scale Reference

| Role | Classes | Use Case |
|------|---------|----------|
| Page Title | `text-xl md:text-2xl font-bold` | Feature headers, modal titles |
| Section Title | `text-base md:text-lg font-semibold` | Panel headers, card titles |
| Body | `text-sm font-medium` | Labels, descriptions |
| Caption | `text-xs font-normal` | Helper text, metadata |

---

## Task 1: Feature Components - Page Titles

**Files to modify:**
- `components/VirtualTryOn.tsx`
- `components/LookbookGenerator.tsx`
- `components/BackgroundReplacer.tsx`
- `components/PoseChanger.tsx`
- `components/SwapFace.tsx`
- `components/PhotoAlbumCreator.tsx`
- `components/OutfitAnalysis.tsx`
- `components/Relight.tsx`
- `components/Upscale.tsx`
- `components/ImageEditor.tsx`
- `components/VideoGenerator.tsx`
- `components/VideoContinuity.tsx`
- `components/Inpainting.tsx`
- `components/GRWMVideoGenerator.tsx`

**Step 1: Search and replace Page Title patterns**

Find all occurrences of these patterns and replace:
- `text-2xl font-bold` → `text-xl md:text-2xl font-bold`
- `text-2xl font-semibold` → `text-xl md:text-2xl font-bold`
- `text-3xl` → `text-xl md:text-2xl font-bold`

**Step 2: Verify visually**

Run: `npm run dev`
Check each feature page title displays correctly on mobile and desktop.

**Step 3: Commit**

```bash
git add components/*.tsx
git commit -m "style(typography): apply responsive Page Title scale to feature components"
```

---

## Task 2: Modal Titles

**Files to modify:**
- `components/modals/GalleryModal.tsx`
- `components/modals/ImageSelectionModal.tsx`
- `components/modals/PoseLibraryModal.tsx`
- `components/modals/SettingsModal.tsx`

**Step 1: Apply Page Title scale to modal headers**

Find modal title elements (usually first h2/h3 in modal) and ensure they use:
`text-xl md:text-2xl font-bold`

**Step 2: Commit**

```bash
git add components/modals/*.tsx
git commit -m "style(typography): apply responsive Page Title scale to modals"
```

---

## Task 3: Section Titles

**Files to modify:**
- All feature components with panel/section headers
- `components/GeneratedImage.tsx`
- `components/SavedLookbooks.tsx`

**Step 1: Identify Section Title candidates**

Search for `text-lg font-semibold` or `text-lg font-bold` patterns that represent section headers (not page titles).

**Step 2: Apply Section Title scale**

Replace with: `text-base md:text-lg font-semibold`

**Step 3: Commit**

```bash
git add components/*.tsx
git commit -m "style(typography): apply responsive Section Title scale"
```

---

## Task 4: Header Component

**Files to modify:**
- `components/Header.tsx`

**Step 1: Review Header typography**

Check app name/logo text and ensure it uses appropriate scale.
- App name: `text-xl md:text-2xl font-bold`
- Nav items: `text-sm font-medium`

**Step 2: Commit**

```bash
git add components/Header.tsx
git commit -m "style(typography): standardize Header typography"
```

---

## Task 5: Body and Caption Cleanup

**Files to modify:**
- All components

**Step 1: Audit text-base usage**

Currently only 5 uses of `text-base`. Review each:
- If it's body text → keep as `text-sm font-medium`
- If it's section title → apply Section Title scale

**Step 2: Audit font-bold on small text**

Find `text-sm font-bold` or `text-xs font-bold` patterns:
- `text-sm` should use `font-medium` (Body)
- `text-xs` should use `font-normal` (Caption)
- Exception: labels that need emphasis can keep `font-semibold`

**Step 3: Commit**

```bash
git add .
git commit -m "style(typography): normalize Body and Caption weights"
```

---

## Task 6: Final Verification

**Step 1: Build check**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Visual regression check**

Run: `npm run dev`
Test on:
- Desktop viewport (1280px+)
- Mobile viewport (375px)

Verify all text is readable and consistent.

**Step 3: Final commit (if any fixes)**

```bash
git add .
git commit -m "style(typography): final typography adjustments"
```

---

## Summary

| Task | Files | Focus |
|------|-------|-------|
| 1 | 14 feature components | Page Titles responsive |
| 2 | 4 modals | Modal titles responsive |
| 3 | Section headers | Section Titles responsive |
| 4 | Header | App header typography |
| 5 | All | Body/Caption weight cleanup |
| 6 | - | Verification |

**Estimated changes:** ~50-70 class replacements across 20+ files.
