# Design Guidelines - Chang-Store

**Last Updated**: 2024-12-24 | **Version**: 1.0

---

## 1. Design Philosophy

**Dark Glassmorphism** - Premium, modern aesthetic with depth through layered transparency, subtle gradients, and purposeful animations.

### Core Principles

1. **Mobile-First** - Design for 320px, scale up
2. **Accessibility** - WCAG 2.1 AA minimum
3. **Performance** - 60fps animations, lazy loading
4. **Consistency** - Design tokens for all values
5. **Delight** - Thoughtful micro-interactions

---

## 2. Color System

### Primary Palette

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#6366F1` | CTAs, active states, links |
| `primary-hover` | `#7C3AED` | Hover on primary elements |
| `primary-glow` | `rgba(99, 102, 241, 0.2)` | Glow effects, shadows |

### Background Gradient

```css
background: radial-gradient(
  ellipse at top,
  #312E81 0%,    /* Deep indigo */
  #1E1B4B 30%,   /* Purple-navy */
  #0F172A 60%,   /* Dark navy */
  #000000 100%   /* Black */
);
```

| Token | Value | Usage |
|-------|-------|-------|
| `bg-start` | `#0F172A` | Nav background |
| `bg-mid` | `#1E1B4B` | Gradient midpoint |
| `bg-end` | `#000000` | Page bottom |

### Surface Colors

| Token | Value | Usage |
|-------|-------|-------|
| `surface-card` | `rgba(30, 41, 59, 0.6)` | Default glass cards |
| `surface-elevated` | `rgba(30, 41, 59, 0.8)` | Elevated cards, modals |

### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| `text-primary` | `#FFFFFF` | Headings, body text |
| `text-secondary` | `#94A3B8` | Captions, descriptions |
| `text-muted` | `#64748B` | Placeholders, disabled |

### Border Colors

| Token | Value | Usage |
|-------|-------|-------|
| `border` | `rgba(255, 255, 255, 0.1)` | Default borders |
| `border-hover` | `rgba(255, 255, 255, 0.2)` | Hover state borders |

---

## 3. Typography

### Font Family

**Plus Jakarta Sans** - Modern geometric sans-serif with Vietnamese support.

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Fallback: `system-ui, -apple-system, sans-serif`

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `heading` | 24px | 700 | 1.2 | Page titles |
| `subheading` | 16px | 600 | 1.4 | Section headers |
| `body` | 14px | 400 | 1.5 | Body text |
| `caption` | 12px | 500 | 1.4 | Labels, chips |
| `tiny` | 11px | 500 | 1.3 | Nav labels |

---

## 4. Spacing

**8pt Grid System**

| Token | Value | Usage |
|-------|-------|-------|
| `1` | 4px | Tight spacing |
| `2` | 8px | Icon gaps |
| `3` | 12px | Card gaps |
| `4` | 16px | Section padding |
| `5` | 20px | Page margins |
| `6` | 24px | Section spacing |
| `8` | 32px | Large gaps |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `card` | 16px | Standard cards |
| `card-lg` | 20px | Modals, large cards |
| `button` | 12px | Buttons, inputs |
| `chip` | 8px | Chips, tags |
| `full` | 9999px | Avatars, pills |

---

## 6. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `card` | `0 4px 24px rgba(0, 0, 0, 0.3)` | Default elevation |
| `elevated` | `0 8px 32px rgba(99, 102, 241, 0.2)` | Active/focused |
| `glow` | `0 0 20px rgba(99, 102, 241, 0.4)` | CTA emphasis |

---

## 7. Glass Morphism

### Default Glass Card
```css
.glass-card {
  background: rgba(30, 41, 59, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}
```

### Elevated Glass
```css
.glass-elevated {
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.2);
}
```

---

## 8. Components

### Buttons

| Variant | Background | Text | Usage |
|---------|------------|------|-------|
| Primary | `#6366F1` | White | CTAs, submit |
| Secondary | Glass card | Text primary | Cancel, alt actions |
| Ghost | Transparent | Text primary | Tertiary actions |
| Danger | `#EF4444` | White | Destructive |

**Sizes**: sm (32px), md (40px), lg (48px)

### Cards

- Padding: 16px default
- Touch target: Minimum 44x44px
- Interactive: Scale 0.98 on tap

### Chips

- Height: 36px (md), 28px (sm)
- Selected: Primary background
- Unselected: Border only

### Inputs

- Height: 44px
- Icon left (optional)
- Focus ring: Primary 50% opacity

---

## 9. Animation

### Timing

| Duration | Usage |
|----------|-------|
| 150ms | Button feedback, hover |
| 250ms | Page transitions |
| 400ms | Modals, overlays |

### Easing

```js
const easing = {
  standard: [0.4, 0, 0.2, 1],
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1]
};
```

### Reduced Motion

Always check `prefers-reduced-motion`:
```js
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
}
```

---

## 10. Accessibility

### Color Contrast

- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- Interactive: Clear focus indicators

### Touch Targets

- Minimum: 44x44px
- Recommended: 48x48px for primary

### Keyboard

- All interactive elements focusable
- Visible focus ring
- Escape closes modals

---

## 11. Responsive Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| Mobile | < 640px | Primary target |
| Tablet | 640-1024px | Adjust grids |
| Desktop | > 1024px | Multi-column |

---

## 12. Icons

**Lucide React** - Consistent 24px icons, 2px stroke.

Common icons:
- `Home`, `Sparkles`, `FolderOpen`, `User` - Navigation
- `ArrowLeft`, `X`, `ChevronRight` - Actions
- `Plus`, `Minus`, `Bell` - UI elements

---

## 13. File Structure

```
components/
  ui/                  # Primitives (Button, Card, etc.)
  mobile/
    layout/            # AppShell, Header, BottomNav
    home/              # Home screen sections
    prompt/            # Prompt input screen
  motion/              # Animation wrappers

lib/
  animations/          # Variants, transitions
  utils/               # cn(), helpers

styles/
  globals.css          # Tailwind + custom utilities
```

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-24 | 1.0 | Initial design system for AI Image Gen App |
