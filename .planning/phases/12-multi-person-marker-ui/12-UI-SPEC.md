---
phase: 12
slug: multi-person-marker-ui
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-02
---

# Phase 12 — UI Design Contract

> Visual and interaction contract for the Multi-Person Marker UI. Adds a mode toggle and canvas overlay dot-marker to VirtualTryOn without any backend changes.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Tailwind classes inline, existing pattern) |
| Preset | not applicable |
| Component library | none (React.FC + Tailwind) |
| Icon library | src/components/Icons.tsx (custom SVG) |
| Font | Inter (inherited from app) |

---

## Spacing Scale

Follows existing VirtualTryOn panel spacing:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, dot radius margin |
| sm | 8px | Toggle label gap |
| md | 16px | Section padding (p-4) |
| lg | 24px | Between toggle and image area |

Exceptions: Marker dot uses `width: 24px; height: 24px` (circle size) — fixed design token, not from scale.

---

## Typography

Matches existing Step 1 panel typography:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Toggle label | 14px (text-sm) | 500 (font-medium) | 1.25 |
| Clear marker button | 12px (text-xs) | 400 | 1.25 |
| Mode hint text | 12px (text-xs) | 400 | 1.25 |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-zinc-950` / `bg-zinc-900/50` | Panel backgrounds (inherited) |
| Secondary (30%) | `bg-zinc-800` / `zinc-700` | Toggle track inactive, borders |
| Accent (10%) | `amber-500` / `amber-400` | Toggle thumb active, active ring |
| Destructive | `red-500` | Marker dot color ONLY |
| Marker border | `white` | Marker circle border for contrast |

Accent reserved for: toggle active state only. Marker dot uses red (not amber) to visually distinguish "targeting" from general UI affordances.

---

## Component Specs

### Multi-Person Mode Toggle

- **Location:** Inside Step 1 panel, below `MultiImageUploader` / clear button — before the clothing column
- **Layout:** `flex items-center justify-between` row
- **Left:** Label `"Multi-person mode"` (text-sm font-medium text-zinc-300)
- **Right:** Pill toggle — `w-9 h-5` track, `w-4 h-4` thumb, amber-500 when active, zinc-700 when inactive
- **Inactive state:** Toggle track `bg-zinc-700`, thumb white, text-zinc-400 (dimmed to hint discoverability)
- **Active state:** Toggle track `bg-amber-500`, thumb white, label text-zinc-200
- **Hint text:** Below toggle — `text-xs text-zinc-500` — `"Click on subject image to mark target person"` (shown only when mode is active)
- **Transition:** `transition-colors duration-200` on track

### Marker Overlay

- **Structure:** `<div className="relative">` wrapping the subject image — overlay `<canvas>` or `<div>` positioned `absolute inset-0`
- **Cursor:** `cursor-crosshair` when mode is active and subject image is present; default otherwise
- **Marker dot:** Red filled circle, `24px × 24px`, white border `2px`, `border-radius: 50%`, centered on click point
- **Dot position:** `absolute`, `transform: translate(-50%, -50%)` at click coordinates
- **z-index:** Overlay div at `z-10`; pointer-events: none when mode is inactive

### Clear Marker Button

- **Visibility:** Rendered only when `markerPosition !== null`
- **Style:** Matches existing "Clear subjects" button: `w-full text-xs text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-500/50 rounded-lg py-1.5 transition-colors`
- **Copy:** `"Clear marker"`
- **Placement:** Below the subject image overlay, above the Clear subjects button (if subjects exist)

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Toggle label | `"Multi-person mode"` |
| Toggle hint (active) | `"Click on subject image to mark target person"` |
| Clear marker button | `"Clear marker"` |
| Mode active indicator (aria-label) | `"Multi-person targeting active"` |

All keys go under `virtualTryOn` namespace in `en.ts` and `vi.ts`.

---

## Interaction States

| State | Toggle | Subject image area | Clear button |
|-------|--------|--------------------|--------------|
| Mode off, no marker | Inactive | Normal (no overlay) | Hidden |
| Mode on, no marker | Active + hint | crosshair cursor | Hidden |
| Mode on, marker placed | Active + hint | Marker dot visible | Shown |
| Mode off, marker cleared | Inactive | Normal | Hidden |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None | — | n/a |

No third-party component library used. All elements implemented with standard HTML + Tailwind classes matching existing codebase patterns.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — specific copy defined for all interactive elements
- [x] Dimension 2 Visuals: PASS — marker dot, toggle, and button specs complete
- [x] Dimension 3 Color: PASS — amber accent, red marker, zinc neutrals match existing palette
- [x] Dimension 4 Typography: PASS — text-sm/xs with font-medium matches existing Step 1 panel
- [x] Dimension 5 Spacing: PASS — follows existing p-4 panel grid, no ad-hoc values
- [x] Dimension 6 Registry Safety: PASS — no new dependencies

**Approval:** approved 2026-04-02
