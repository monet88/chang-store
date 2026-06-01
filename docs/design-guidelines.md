# Design Guidelines

Chang Store uses a Runway-inspired fashion studio interface: editorial,
image-forward, dark surfaces, precise controls, and polished tool panels.

## Visual Style

- Prioritize generated images and uploaded assets over decorative UI.
- Use high-contrast dark surfaces with subtle borders and layered panels.
- Keep controls compact but readable for creative workflow density.
- Preserve strong hierarchy: feature header → upload/config panel → results.

## Component Design

- Components should look intentional, not default Tailwind templates.
- Use consistent button, tab, upload, modal, and image-card patterns.
- Prefer reusable shared components in `src/components/` when behavior repeats.
- Keep feature components thin; visual composition only.

## Styling Rules

- Tailwind CSS only.
- No inline styles.
- No CSS modules.
- No `@apply`.
- Follow existing UI patterns before inventing new variants.

## Z-Index Layer Scale

Semantic z-index tokens defined in `src/index.css`. Use the matching
`@utility z-*` classes instead of ad-hoc `z-50` / `z-[60]`:

| Token | Value | Usage |
|---|---|---|
| `--z-index-base` | 0 | Default document flow |
| `--z-index-dropdown` | 1000 | Dropdown menus, popups |
| `--z-index-sticky` | 1100 | Sticky chrome (header menu button, utility dock) |
| `--z-index-overlay` | 1200 | Backdrop overlays (mobile nav overlay) |
| `--z-index-sidebar` | 1250 | Mobile sidebar/drawer panels (slides over overlay) |
| `--z-index-modal-backdrop` | 1300 | Modal dialog backdrops |
| `--z-index-modal` | 1400 | Modal dialog panels |
| `--z-index-toast` | 1500 | Toast notifications |
| `--z-index-tooltip` | 1600 | Tooltips, floating hints |

`z-sidebar` lives between `z-overlay` and `z-modal-backdrop` so that a
sidebar/drawer panel sits above its backdrop but below modal dialogs.

## Localization

- All user-facing copy must use `useLanguage()` and `t('key.path')`.
- `src/locales/en.ts` is source of truth.
- `src/locales/vi.ts` mirrors the English keys.
- Avoid hardcoded strings in feature components and hooks.

## Accessibility

- Interactive elements need visible hover/focus/active states.
- Use semantic HTML for buttons, forms, dialogs, and navigation.
- Minimum touch target: 44px where practical.
- Preserve keyboard access for modals and menus.
- Do not rely on color alone to communicate state.

## Responsive Design

Test at key breakpoints:

- 320px
- 375px
- 768px
- 1024px
- 1440px
- 1920px

Avoid horizontal overflow on mobile. Use Tailwind responsive utilities and keep
image grids flexible.
