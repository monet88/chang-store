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
- Source of truth is `src/locales/en.ts`.
- `src/locales/vi.ts` serves as the translation mirror.
- Always implement text rendering using:
  ```typescript
  const { t } = useLanguage();
  t('key.path');
  ```
- Do not hardcode strings in components.
