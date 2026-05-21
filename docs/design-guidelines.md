# Design Guidelines

## Visual Style
- **Aesthetic**: Runway-inspired, premium, and minimalistic.
- **Styling Strategy**: Use Tailwind CSS v4 exclusively. No inline styles. No `@apply` directives.
- **Colors & Typography**: Rely on the defined Tailwind theme. Utilize glassmorphism, dynamic animations, and high-contrast elements where appropriate for a "virtual studio" feel.

## Component Design
- **Thin UI Wrappers**: Components should only contain render logic and UI event bindings.
- **Error States**: Display errors via the central `ToastProvider` or inline using localized strings.
- **Loading States**: All generative actions must have clear, elegant loading indicators (spinners or skeleton loaders).

## Localization (i18n)
- Source of truth is `src/locales/en.ts` (~1,011 LOC).
- `src/locales/vi.ts` serves as the translation mirror (~1,014 LOC).
- Always implement text rendering using:
  ```typescript
  const { t } = useLanguage();
  t('key.path');
  ```
- Do not hardcode strings in components.

## Accessibility
- Use semantic HTML elements (button, input, form, etc.)
- Ensure all interactive elements are keyboard accessible
- Provide ARIA labels for icon-only buttons and complex components
- Maintain sufficient color contrast (WCAG AA minimum)
- Test with screen readers during development

## Responsive Design
- Mobile-first approach using Tailwind breakpoints
- Test at key breakpoints: 320px, 375px, 768px, 1024px, 1440px, 1920px
- Ensure no horizontal overflow on mobile devices
- Touch-friendly interactive elements (minimum 44px tap targets)
- Flexible layouts using Tailwind's responsive utilities
