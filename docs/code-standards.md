# Code Standards

Last updated: 2026-05-03

## File Organization

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Component files | PascalCase | `VirtualTryOn.tsx` |
| Hook files | camelCase, `use` prefix | `useVirtualTryOn.ts` |
| Service files | camelCase | `imageEditingService.ts` |
| Utility files | kebab-case | `prompt-builder.ts` |
| Config files | camelCase | `modelRegistry.ts` |
| Context files | PascalCase, `Context` suffix | `AuthContext.tsx` |
| Test files | Match source name | `useVirtualTryOn.test.ts` |
| Type files | camelCase | `types.ts` |
| API handler dirs | kebab-case | `auth/login.ts` |
| Backend modules | kebab-case | `rate-limiter-storage.ts` |

### File Size Limits

- **Source files**: 200-400 lines typical, 800 lines maximum
- **Components**: Keep under 400 lines (extract sub-components to `components/feature-name/`)
- **Hooks**: Keep under 400 lines (extract helpers to utils)
- **Documentation**: 800 lines maximum per file

### Directory Structure

```
src/
├── components/       # Thin UI wrappers, no business logic
│   ├── shared/       # Shared UI components (RefinementInput, etc.)
│   └── modals/       # Modal components
├── hooks/            # Feature logic + state + API calls
├── services/         # Stateless API facades
│   └── gemini/       # Gemini provider modules
├── contexts/         # Global state providers
├── config/           # Model registry, feature registry
├── utils/            # Pure helper functions
├── locales/          # i18n: en.ts (source) + vi.ts
└── types.ts          # Central type definitions
```

## Architecture Rules

### Component/Hook Separation (MANDATORY)

Components are thin UI wrappers. They render markup and bind to hook state. Zero business logic. Zero direct service imports.

```typescript
// CORRECT: Component delegates to hook
function VirtualTryOn() {
  const { state, handleGenerate, handleDownload } = useVirtualTryOn();
  return <div>...</div>;
}

// WRONG: Component calls service directly
function VirtualTryOn() {
  const handleClick = async () => {
    await imageEditingService.editImage(...);  // Never do this
  };
}
```

### Error Handling Pattern

Every async operation in hooks must follow this pattern:

```typescript
const handleGenerate = async () => {
  setIsLoading(true);
  setError(null);
  try {
    const result = await someAsyncOperation();
    setResult(result);
  } catch (err) {
    setError(getErrorMessage(err, t));
  } finally {
    setIsLoading(false);
  }
};
```

### Service Routing

All AI operations go through `src/services/imageEditingService.ts`. Never import `src/services/gemini/*` directly from components or hooks.

### Immutability

Never mutate objects or arrays. Use spread/rest, `map`, `filter`, and `reduce`.

```typescript
// CORRECT
const updated = { ...obj, field: newValue };
const filtered = items.filter(item => item.active);

// WRONG
obj.field = newValue;
items.push(newItem);
```

## TypeScript Standards

### Type Definitions

- Central shared types in `src/types.ts`
- Feature-specific types co-located with the feature or in types.ts
- Use `interface` for object shapes that may be extended
- Use `type` for unions, intersections, and derived types
- Prefer string literal unions over `enum` unless codebase convention (`Feature` enum is an exception)
- Avoid `any`; use `unknown` for untrusted input

### Function Signatures

- All exported functions must have explicit parameter and return types
- Local variables may use type inference
- Callback props in components must be typed explicitly

```typescript
interface UserCardProps {
  user: AuthenticatedUser;
  onSelect: (id: string) => void;
}
```

## React Standards

### Component Definition

- Use named function declarations, not `React.FC`
- Define props as a named interface above the component
- Use `React.lazy` for code-split feature components

### Hooks

- Custom hooks must start with `use`
- Hooks own all state, API calls, validation, and side effects
- Return stable references -- memoize callbacks with `useCallback`, values with `useMemo` when passed as props
- No hook composition depth exceeding 3 levels

### Context

- Provider components wrap their state in a context
- Export both the Provider and a consumer hook
- Provider nesting order must be preserved: Language -> Toast -> Api -> Auth -> ImageGallery -> ImageViewer -> AuthGate -> AppContent

## Backend Standards

### API Handlers

- Follow Vercel Functions convention: export default `{ fetch }` object
- Use `withCsrf()` wrapper for mutating endpoints
- Explicit auth check at the top of each handler
- Return structured JSON errors with appropriate HTTP status codes

```typescript
const handler = withCsrf({
  async fetch(request: Request): Promise<Response> {
    const session = await getAuthenticatedSessionFromRequest(db, request);
    if (!session) return errorResponse('Authentication required.', 401);
    // ...
  },
});
export default handler;
```

### Database Queries

- Use the `sql` tagged template helper for parameterized queries
- Never concatenate user input into SQL strings
- Use `withTransaction()` for multi-statement operations
- Map rows through dedicated `rowTo*` functions, not inline casting

```typescript
const q = sql`SELECT * FROM users WHERE username = ${username}`;
const result = await db.query(q.text, q.values);
```

### Validation

- Use Zod schemas for all API input validation
- Export inferred types from schemas
- Use `formatZodErrors()` for structured error responses
- Add new feature schemas to the `featureSchemas` record in `server/validation.ts`

## Testing Standards

### Coverage

- 80% minimum coverage on all paths
- Unit tests for hooks and utilities
- Integration tests for API endpoints (in `__tests__/services/`)
- Component tests for UI interactions

### Test Structure

- AAA pattern: Arrange, Act, Assert
- Descriptive test names: `test('returns empty array when no markets match query', () => {})`
- Test error paths explicitly
- Use centralized mocks from `__tests__/__mocks__/`

### What to Test

- Hook state transitions (loading -> success, loading -> error)
- Validation logic and edge cases
- API error handling and retry logic
- User interactions (clicks, uploads, form submissions)

## Styling Standards

- Tailwind CSS v4 only -- no inline styles, no `@apply`
- Follow Runway-inspired dark cinematic workspace patterns
- Use semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<section>`)
- No hardcoded colors; use Tailwind's design tokens

## Git Standards

### Commits

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- No AI references in commit messages
- Small, focused commits

### Pre-Commit Checklist

1. `npx tsc --noEmit` passes
2. `npm run lint` passes
3. `npm run test` passes
4. No `console.log` statements (use proper logging)
5. No hardcoded secrets or credentials
6. GitNexus impact analysis reviewed for modified symbols

## Quality Gates

Every change must pass these gates before merge:

| Gate | Command | Required |
|------|---------|----------|
| Type-check | `npx tsc --noEmit` | Always |
| Lint | `npm run lint` | Always |
| Tests | `npm run test` | Always |
| Build | `npm run build` | For major cross-feature changes |
| Coverage | Vitest coverage report | Must be >=80% |

## Related Documents

- [System Architecture](./system-architecture.md) -- How the pieces fit together
- [Project Overview & PDR](./project-overview-pdr.md) -- Requirements and constraints
- [Codebase Summary](./codebase-summary.md) -- File-by-file inventory
