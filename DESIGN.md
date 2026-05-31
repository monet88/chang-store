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

| Role | Token | Use |
|------|-------|-----|
| `accent/strong` | `bg-amber-500` | Selected pose, focus ring base |
| `accent/primary` | `bg-amber-600` | Default primary CTA |
| `accent/hover` | `hover:bg-amber-500` | Primary CTA hover |
| `accent/glow` | `shadow-amber-500/30` | Primary CTA shadow |
| `accent/secondary` | `text-amber-400` | Inline emphasis on dark |
| `accent/edge` | `border-amber-500` | Active outline on form fields |

The bottle of "from-amber-500 to-orange-600" gradient appears on the primary
CTA across all studios. It's the only gradient in the system; using it
elsewhere is an anti-pattern.

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

```tsx
<button className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600
  px-8 py-3 font-bold text-white shadow-lg shadow-amber-500/30
  transition-opacity hover:opacity-90 disabled:cursor-not-allowed
  disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70">
  {t('common.generate')}
</button>
```

Used identically across all 9 Gemini features and all 10 provider workflows.
Do not branch this style; extract into a `<PrimaryButton>` if its instances
ever need tuning.

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

1. **Dual neutrals.** The codebase uses both `zinc-*` (most surfaces) and
   `slate-*` (Quality selector, modals). Standardize on `zinc-*` and migrate
   `slate-*` callsites in a single pass.
2. **Dual heading scales.** `text-4xl` and `text-5xl` for the same heading
   role; spec the responsive clamp once and use it everywhere.
3. **Mixed scrollbar tokens.** The custom scrollbar in `index.html` uses
   white-alpha tokens; many panels still use Tailwind defaults. Pick one.
4. **No `prefers-reduced-motion` declarations.** Add to global stylesheet
   alongside the existing `@keyframes`.
5. **No design tokens file.** Tailwind classes are the contract. Extract
   `--accent`, `--surface`, `--ink` CSS variables in `src/index.css` (or wire
   Tailwind theme extension) so the amber ramp can be retuned in one place.
