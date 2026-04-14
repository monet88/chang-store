# Chang-Store: Code Standards

**Last Updated:** 2026-03-17

## 1. React/TypeScript Conventions

### 1.1 Component Declaration

```typescript
// Functional components with explicit typing (React 19)
const FeatureName: React.FC = () => {
  // Hook calls first - all business logic lives here
  const { t } = useLanguage();
  const { state, handlers } = useFeatureHook();

  // Thin UI wrapper - minimal local state
  return (
    <FeatureUI 
      data={state} 
      onAction={handlers.handleAction} 
      t={t} 
    />
  );
};
```

### 1.2 TypeScript Strictness

- **Strict Mode**: Enabled
- **No `any`**: Prefer explicit types or `unknown`
- **Interface over Type**: For object shapes
- **Enums**: Used for feature identifiers (`Feature` enum)

### 1.3 Import Order

```typescript
// 1. React and external libraries
import React, { useState, useEffect, useMemo, useCallback } from 'react';

// 2. Internal contexts/hooks
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';

// 3. Internal services/utils
import { editImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';

// 4. Types
import { Feature, ImageFile } from '../types';

// 5. Sibling components
import ImageUpload from './shared/ImageUpload';
```

## 2. Component Patterns

### 2.1 Feature + Hook Pattern (Thin UI)

Every feature follows a strict separation:

| Layer | Responsibility | Example |
|-------|----------------|---------|
| **Component** (`.tsx`) | Thin UI wrapper, event binding, layout | `VirtualTryOn.tsx` |
| **Hook** (`.ts`) | State management, business logic, API calls | `useVirtualTryOn.ts` |

**Hook Structure:**
```typescript
export const useFeatureName = () => {
  // State declarations
  const [results, setResults] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Context access
  const { addImage } = useImageGallery();
  const { t } = useLanguage();
  const { getModelsForFeature } = useApi();

  // Handlers (memoized)
  const handleGenerate = useCallback(async () => { ... }, [...]);

  // Return structured state and handlers
  return {
    state: { results, isLoading },
    handlers: { handleGenerate }
  };
};
```

### 2.2 Conditional Feature Rendering

Features use CSS display toggling for instant switching (no unmount) to preserve state:

```tsx
<div style={{ display: activeFeature === Feature.TryOn ? 'block' : 'none' }}>
  <VirtualTryOn />
</div>
```

### 2.3 Modal Pattern

```typescript
// Parent controls visibility
const [isModalOpen, setIsModalOpen] = useState(false);

// Modal receives isOpen + onClose
<FeatureModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
/>
```

## 3. State Management

### 3.1 Context Usage

| Context | When to Use |
|---------|-------------|
| `LanguageContext` | Any text displayed to user (i18n) |
| `ApiContext` | API key checks, model selection, provider config |
| `GoogleDriveContext` | Cloud storage operations, OAuth |
| `ImageGalleryContext` | Saving/retrieving images (LRU cache + Drive sync) |
| `ImageViewerContext` | Fullscreen image display |

### 3.2 Local State

- Feature-specific business logic lives in hooks.
- Component-local UI state (toggles, tabs) lives in the component.
- Form inputs as `useState` within the hook or a dedicated form component.
- Persistence: `localStorage` for settings/drafts, Google Drive for assets.

### 3.3 Derived State

Compute in render or useMemo, not separate state:
```typescript
// Good
const validItems = useMemo(() => items.filter(item => item.image !== null), [items]);
```

## 4. File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `VirtualTryOn.tsx` |
| Hook | camelCase with `use` prefix | `useVirtualTryOn.ts` |
| Service | camelCase | `imageEditingService.ts` |
| Context | PascalCase with `Context` suffix | `ApiProviderContext.tsx` |
| Types | PascalCase (file: `types.ts`) | `ImageFile`, `AspectRatio` |
| Locales | lowercase | `en.ts`, `vi.ts` |

## 5. Error Handling

### 5.1 API Error Pattern

```typescript
try {
  setIsLoading(true);
  const results = await serviceCall(...);
  setResults(results);
} catch (err) {
  setError(getErrorMessage(err, t)); // Localized error
} finally {
  setIsLoading(false);
}
```

### 5.2 Error Message Utility

```typescript
// utils/imageUtils.ts
export const getErrorMessage = (err: unknown, t: TranslationFn): string => {
  if (err instanceof Error) {
    if (err.message.startsWith('error.')) return t(err.message);
    return err.message;
  }
  return t('error.unknown');
};
```

## 6. Service Layer Pattern

### 6.1 Unified Facade

`imageEditingService.ts` centralizes Gemini image operations:

```typescript
export const editImage = async (params, model, config) => {
  return geminiImageService.editImage({ ...params, model });
};
```

## 7. Pure Functions Pattern

### 7.1 Prompt Builders (DRY)

Extract complex prompt generation logic into pure functions in `utils/`:

```typescript
// utils/lookbookPromptBuilder.ts
export const buildLookbookPrompt = (formState: LookbookFormState): string => {
  // Pure logic...
};
```

## 8. i18n Pattern

### 8.1 Translation Keys

- Source of truth: `locales/en.ts`.
- Vietnamese translation: `locales/vi.ts`.
- Usage: `const { t } = useLanguage(); t('key.path')`.

## 9. Testing Conventions

- Framework: Vitest.
- Component tests: React Testing Library.
- Coverage goals: 80%+ for services, 90%+ for contexts.

## 10. Performance Optimization

- **Memoization**: Use `React.memo`, `useMemo`, and `useCallback` extensively for stable props.
- **Resource Cleanup**: Always clean up canvas contexts, animation frames, and event listeners in `useEffect` return.
- **Debouncing**: Use debounced writes for `localStorage` persistence.
- **Lazy Loading**: Use `React.lazy` for heavy feature components.
