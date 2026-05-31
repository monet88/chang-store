# Design

> Visual system snapshot for Chang Store. Produced by `/impeccable init` from
> the existing codebase. Re-run `/impeccable document` after major visual
> changes to refresh.

## Theme

**Dark, near-black workbench.** The body is `#050505` (declared in
`index.html`). The studio renders generated imagery as the loudest object on
the screen; the chrome stays close to the background so output never has to
compete with UI accent.

This is **not** a light/dark toggleable surface. The studio is dark by
intent — it matches the colorist/finishing rooms its users come from and keeps
amber/skin tones in generated imagery legible.

## Color Palette

### Base surface

| Role | Token | Notes |
|------|-------|-------|
| `--bg` | `bg-[#050505]` | Body background (set on `<body>` in index.html) |
| `--surface-1` | `bg-zinc-900` / `bg-black/90` | Sidebar, modal scrim |
| `--surface-2` | `bg-zinc-800` / `bg-white/[0.04]` | Cards, panels, inputs |
| `--surface-3` | `bg-zinc-700` | Hover/active states on surface-2 |
| `--border-soft` | `border-white/10` | Default 1px hairline |
| `--border-strong` | `border-white/20` | Hover hairline |

### Ink (text)

| Role | Token | Use |
|------|-------|-----|
| `ink/strong` | `text-zinc-50` | Headings, primary stats |
| `ink/body` | `text-zinc-100` | Body copy default |
| `ink/muted` | `text-zinc-300` | Secondary copy, labels |
| `ink/subtle` | `text-zinc-400` | Eyebrows, captions, meta |
| `ink/disabled` | `text-zinc-500` | Disabled inputs, placeholder |

### Accent — amber/orange ramp

The single brand accent. One ramp, used sparingly to mark "active" or
"primary action".

The ramp lives in `src/index.css` `@theme` as CSS variables. Tune the brand
once, never re-bake in components.

| CSS variable | Hex | Use |
|---|---|---|
| `--brand-50` | `#fff8eb` | Tints |
| `--brand-100` | `#ffeac7` | Tints |
| `--brand-200` | `#fed089` | Tints |
| `--brand-300` | `#fdba74` | Soft accent |
| `--brand-400` | `#fbbf24` | Soft accent (alias `bg-amber-400`) |
| `--brand-500` | `#f59e0b` | Selected pose, focus ring base (alias `bg-amber-500`) |
| `--brand-600` | `#ea580c` | Default primary CTA stop end (alias `bg-orange-600`) |
| `--brand-700` | `#c2410c` | Hover end |
| `--brand-800` | `#9a3412` | Pressed |
| `--brand-900` | `#7c2d12` | Backdrop tint |
| `--brand-glow` | `oklch(0.78 0.18 65 / 0.30)` | Primary CTA glow shadow |
| `--brand-gradient` | `linear-gradient(to right, var(--brand-500), var(--brand-600))` | Single source for the primary CTA gradient |

The bottle of `from-amber-500 to-orange-600` gradient appears on the primary
CTA across all studios — now expressed once via the `brand-button`
`@utility`. Using a hand-rolled gradient elsewhere is an anti-pattern.

### Z-index — semantic scale

Replaces the ad-hoc `z-10 / 20 / 30 / 40 / 50 / [52] / [60] / [100]` ladder.
Defined in `@theme`, exposed via `@utility` classes.

| Token | Value | Utility class | Use |
|---|---|---|---|
| `--z-index-base` | 0 | (default) | content layer |
| `--z-index-dropdown` | 1000 | `z-dropdown` | menus, mention popovers |
| `--z-index-sticky` | 1100 | `z-sticky` | header / sidebar / mobile chrome |
| `--z-index-overlay` | 1200 | `z-overlay` | mobile drawer scrim |
| `--z-index-modal-backdrop` | 1300 | `z-modal-backdrop` | image lightbox, gallery scrim |
| `--z-index-modal` | 1400 | `z-modal` | settings, prompt library, modal nav buttons |
| `--z-index-toast` | 1500 | `z-toast` | toast notifications |
| `--z-index-tooltip` | 1600 | `z-tooltip` | tooltip popovers |

`z-10` / `z-20` / `z-30` are still used for **intra-component** stacking
(badge over thumbnail, hover overlay over base image). The semantic scale is
for cross-component fixed/portal layers only.

### Status

| Role | Token | Use |
|------|-------|-----|
| `status/error` | `bg-red-900/20 text-red-400` | Inline errors |
| `status/error-strong` | `bg-red-600` | Destructive primary |
| `status/success` | `text-emerald-400` | Saved/synced indicators |

## Typography

### Family

- Display + body: **Be Vietnam Pro** (loaded from Google Fonts in
  `index.html`), weights 400/500/600/700.
- Mono: not currently used. Reserve a system mono stack for future code/JSON
  surfaces if added.

Be Vietnam Pro is a humanist sans-serif tuned for Vietnamese diacritics. It
covers both the EN and VI surfaces from one family — keep it that way; do not
introduce a Latin-only secondary face.

### Scale

Steps actually present in the codebase. The scale is conservative — no display
clamp, no hero. Largest on-screen string is `text-4xl` on the active feature
title (`AppContent` uses `text-4xl sm:text-5xl`).

| Step | Token | Use |
|------|-------|-----|
| `display/xl` | `text-5xl` | Feature title (responsive `sm:`) |
| `display` | `text-4xl` | Feature title (mobile) |
| `h2` | `text-2xl` / `text-3xl` | Modal headings |
| `h3` | `text-xl` | Panel headings |
| `body` | `text-base` | Default paragraph |
| `body-sm` | `text-sm` | Form labels, secondary copy (most-used: 171 occurrences) |
| `meta` | `text-xs` | Eyebrows, captions (uppercase tracked) |

### Weights

`font-medium` (500) for headings, `font-semibold` (600) for buttons and meta
labels, `font-bold` (700) reserved for primary CTAs and selected-state pills.

### Tracking

- Display headings: `tracking-[-0.045em]` to `tracking-[-0.03em]` (negative,
  optical correction at large sizes).
- Eyebrows / labels: `tracking-[0.2em]` to `tracking-[0.28em]` (uppercase
  small caps — `text-zinc-400 uppercase`).

## Spacing & Layout

### Frame

- Sidebar: fixed 22rem (`w-[22rem]`) on `lg+`, full-width drawer below.
- Main content: `max-w-[1760px]`, `px-4 sm:px-6 lg:px-10 xl:px-12`,
  `pb-8 pt-20 lg:pt-10`.
- Sections separated by `border-b border-white/10` (no card-in-card).

### Spacing scale

The codebase uses Tailwind defaults. Frequent steps: `gap-2`, `gap-3`, `gap-4`,
`gap-6`, `gap-8`. Vertical rhythm comes from `space-y-3` / `space-y-5` /
`space-y-8`.

### Radius

| Token | Use |
|-------|-----|
| `rounded-md` | Small buttons inside button groups |
| `rounded-lg` | Inputs, secondary buttons, panel chrome |
| `rounded-xl` | Inputs that share a row with primary CTA |
| `rounded-2xl` | Cards, dropzones, modal containers |
| `rounded-full` | Pills, avatars, primary CTA, focus dots, spinner geometry |

The most-used radius is `rounded-full` (105 occurrences), driven mostly by the
primary CTA pill style and CSS spinners. After that, `rounded-lg` (73) is the
default for chrome.

## Components

### Primary CTA

The single source: `brand-button` utility from `src/index.css`. Replaces the
hand-rolled `bg-gradient-to-r from-amber-500 to-orange-600 ...` callsite
duplicated across studios.

```tsx
<button className="brand-button">{t('common.generate')}</button>
```

Encapsulates: `--brand-gradient` background, white text, `font-bold`,
`min-h-[44px]` (touch target), pill `rounded-[9999px]`, `--brand-glow` box
shadow, hover brightness, active translate-y, disabled muted gradient.

Used identically across all 9 Gemini features and all 10 provider workflows.

### Secondary button

```tsx
<button className="rounded-lg border border-white/10 bg-white/[0.04]
  px-4 py-2 text-sm font-medium text-zinc-200 transition-colors
  hover:border-white/20 hover:bg-white/[0.08]">
  {t('common.reset')}
</button>
```

### Input / textarea

```tsx
<input className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80
  px-4 py-3 text-white placeholder-zinc-500
  focus:outline-none focus:ring-2 focus:ring-amber-500/50
  focus:border-amber-500/50 transition-all" />
```

### Dropzone

`rounded-2xl` panel with dashed `border-white/10`, `cursor-pointer`,
`hover:border-white/20 hover:bg-white/[0.06]`. Centered icon + Vietnamese
prompt copy.

### Tabs (sidebar)

Vertical list. Active state swaps to `bg-white/[0.06] text-zinc-50`; idle is
`text-zinc-300 hover:bg-white/[0.04]`.

### Modal

`bg-black/90 backdrop-blur-2xl` scrim, `rounded-2xl border border-white/10`
container. Header has `border-b border-white/10`, footer has `border-t`.

### Loading spinner

CSS spinner pattern: `animate-spin rounded-full border-b-2 border-amber-400
h-8 w-8`. The `border-b-2 + rounded-full` pair is intentional and
`Spinner.tsx` is the canonical source. Detector regex flags it as
`border-accent-on-rounded`; that rule does not apply to spinners.

## Motion

Implemented motion is restrained:

- Tab/feature crossfade: `transition-colors duration-200 ease-out`.
- Modal enter: `animate-fade-in` (custom keyframes in index.html, 0.3s ease-out).
- Sidebar drawer: `transition-transform duration-300 ease-out`.

No `bounce`, no `elastic`, no GSAP/anime. **No `prefers-reduced-motion` media
query is currently declared** — flagging this for the harden pass.

## Iconography

Custom icon set in `src/components/Icons.tsx`. Outline style, 1.5–2 stroke,
24x24 default rendered at `w-5 h-5` to `w-6 h-6`. Color always inherits from
`currentColor` — never hard-coded.

Logo treatment: a simple `GalleryIcon` glyph inside a 44x44 `rounded-full`
chip. The product does not have a wordmark; the brand voice carries the
identity.

## Inconsistencies to clean up

These are flagged here as documentation, not actions. Address with
`/impeccable polish` or `/impeccable extract`.

1. ~~**Dual neutrals.** The codebase uses both `zinc-*` (most surfaces) and
   `slate-*` (Quality selector, modals). Standardize on `zinc-*` and migrate
   `slate-*` callsites in a single pass.~~ **Resolved** (2026-05-31): all
   `slate-*` utilities migrated to `zinc-*` across 18 files.
2. **Dual heading scales.** `text-4xl` and `text-5xl` for the same heading
   role; spec the responsive clamp once and use it everywhere.
3. **Mixed scrollbar tokens.** The custom scrollbar in `index.html` uses
   white-alpha tokens; many panels still use Tailwind defaults. Pick one.
4. ~~**No `prefers-reduced-motion` declarations.**~~ **Resolved** — already
   declared globally in `src/index.css` lines 137-145.
5. ~~**No design tokens file.**~~ **Resolved** (2026-05-31): `src/index.css`
   `@theme` block now declares the brand ramp (`--brand-50` through
   `--brand-900`), the brand gradient (`--brand-gradient`), the focus glow
   (`--brand-glow`), and a semantic z-index scale (`--z-index-dropdown`
   through `--z-index-tooltip`). Eight `@utility z-*` classes generate
   matching utilities. The primary CTA gradient is now expressed as a single
   `brand-button` utility, replacing three duplicated callsites.
