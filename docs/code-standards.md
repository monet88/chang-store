# Code Standards

Project-specific conventions for chang-store. These complement the harness
operating rules and the architecture doc.

## File Organization

| Directory | Naming | Max Lines |
| --- | --- | --- |
| `src/components/` | PascalCase `.tsx` | 200 |
| `src/hooks/` | camelCase `use*.ts` | 200 |
| `src/services/` | camelCase `.ts` | 200 |
| `src/utils/` | kebab-case `.ts` | 200 |
| `src/contexts/` | PascalCase `*Context.tsx` | 200 |
| `src/locales/` | lowercase `.ts` | no limit (i18n) |

When a file exceeds 200 lines, extract into smaller focused modules.

## Component Pattern

Components are thin UI wrappers. They:

- Render JSX using data from their paired hook.
- Dispatch user actions to hook callbacks.
- Contain zero business logic, zero API calls, zero state derivation.

```tsx
const MyFeature: React.FC = () => {
  const { data, isLoading, error, handleGenerate } = useMyFeature();
  // render only — no logic here
};
```

## Hook Pattern

Every feature component has a paired hook (`useFeatureName.ts`). Hooks own:

- All `useState` / `useRef` for the feature.
- API call orchestration via service facades.
- Error handling with the standard pattern.
- Gallery integration (`addImage` from `useImageGallery`).

## Error Handling

Mandatory pattern in all hooks that call services:

```tsx
try {
  // API call
} catch (err) {
  setError(getErrorMessage(err, t));
} finally {
  setIsLoading(false);
}
```

`getErrorMessage` from `src/utils/imageUtils.ts` extracts user-friendly
messages. Always pass the `t` function for i18n error strings.

## Service Boundaries

- Components must not import from `src/services/*` directly.
- Hooks call `imageEditingService` or `textService` — never `gemini/*` directly.
- Services are stateless — no `useState`, no context access.
- API keys come from `ApiProviderContext`, passed through hooks to services.

Known boundary debt: `src/hooks/useWatermarkRemover.ts` currently imports
`@/services/gemini/image` directly. Treat this as existing debt to fix during a
service-boundary cleanup, not as the pattern for new hooks.

## Styling

- **Tailwind CSS only** — no inline styles, no `@apply`, no CSS modules.
- Follow existing Runway-inspired patterns as the canonical UI reference.
- Use design tokens from Tailwind config for colors, spacing, typography.

## i18n

- Source of truth: `src/locales/en.ts`.
- Mirror: `src/locales/vi.ts` (must stay in sync).
- Usage: `const { t } = useLanguage(); t('key.path')`.
- Never hardcode user-facing strings in components or hooks.

## TypeScript

- Strict mode enabled.
- No `@ts-ignore` or `any` unless absolutely necessary with a comment.
- Shared types in `src/types.ts`.
- Feature-local types can live in the hook file if small.
- Run `npx tsc --noEmit` after changes to verify.

## Imports

- Path alias: `@/*` maps to `src/`.
- Prefer `@/` imports over relative paths for cross-directory references.
- Relative imports within the same directory are fine.

## Naming Conventions

| Entity | Convention | Example |
| --- | --- | --- |
| Component | PascalCase | `VirtualTryOn` |
| Hook | camelCase with `use` prefix | `useVirtualTryOn` |
| Service function | camelCase | `editImage` |
| Util function | camelCase | `getErrorMessage` |
| Prompt builder | kebab-case file, camelCase exports | `virtual-try-on-prompt-builder.ts` |
| Type/Interface | PascalCase | `ImageFile`, `LookbookSet` |
| Enum | PascalCase enum, PascalCase values | `Feature.TryOn` |
| Constants | UPPER_SNAKE_CASE | `MAX_CLOTHING_SLOTS` |

## Quality Gates

Run before committing:

```bash
npx tsc --noEmit    # Type check
npm run lint        # ESLint
npm run test        # Vitest
```

All three must pass. Do not suppress errors to pass the build.

Current checkout caveat: the package test wrapper and one tracked E2E-config
test still reference retired files. Until that separate tooling drift is fixed,
use the scoped proof and status recorded in docs/TEST_MATRIX.md; do not claim
the full quality gate is green.

## Adding a New Feature

1. Add enum value to `src/types.ts` → `Feature.XxxYyy`
2. Create `src/components/XxxYyy.tsx` — thin UI wrapper
3. Create `src/hooks/useXxxYyy.ts` — all logic
4. Add lazy import + switch case in `src/App.tsx`
5. Add i18n keys to `src/locales/en.ts` and `vi.ts`
6. If new prompt logic needed: `src/utils/xxx-yyy-prompt-builder.ts`

## Prohibited Patterns

- Business logic in components.
- Direct service imports in components.
- Inline styles or CSS files.
- `console.log` in production code (use `debugService` for API logging).
- Mutable state patterns — prefer immutable updates.
- Creating `*V2.tsx` or `*_new.ts` files — edit in place.
