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
