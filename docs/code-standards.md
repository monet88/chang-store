# Chang-Store: Code Standards

**Last Updated:** 2026-01-04

## 1. React/TypeScript Conventions

### 1.1 Component Declaration

```typescript
// Functional components with explicit typing
const FeatureName: React.FC = () => {
  // Hook calls first
  const { t } = useLanguage();
  const hookData = useFeatureHook();

  // Event handlers
  const handleAction = () => { ... };

  // Render
  return ( ... );
};

export default FeatureName;
// OR
export { FeatureName };
```

### 1.2 TypeScript Strictness

- **Strict Mode**: Enabled
- **No `any`**: Prefer explicit types or `unknown`
- **Interface over Type**: For object shapes
- **Enums**: Used for feature identifiers (`Feature` enum)

### 1.3 Import Order

```typescript
// 1. React and external libraries
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// 2. Internal contexts/hooks
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';

// 3. Internal services/utils
import { editImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';

// 4. Types
import { Feature, ImageFile } from '../types';

// 5. Sibling components
import ImageUpload from './ImageUpload';
```

## 2. Component Patterns

### 2.1 Feature + Hook Pattern

Every feature follows the separation:

| Layer | Responsibility | Example |
|-------|----------------|---------|
| **Component** (`.tsx`) | UI rendering, event binding | `VirtualTryOn.tsx` |
| **Hook** (`.ts`) | State, logic, API calls | `useVirtualTryOn.ts` |

**Hook Structure:**
```typescript
export const useFeatureName = () => {
  // State declarations
  const [input, setInput] = useState<ImageFile | null>(null);
  const [results, setResults] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Context access
  const { addImage } = useImageGallery();
  const { t } = useLanguage();
  const { getModelsForFeature } = useApi();

  // Handlers
  const handleGenerate = async () => { ... };

  // Return public API
  return {
    input, setInput,
    results, isLoading, error,
    handleGenerate,
  };
};
```

### 2.2 Conditional Feature Rendering

Features use CSS display toggling for instant switching (no unmount):

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
| `LanguageContext` | Any text displayed to user |
| `ApiContext` | API key checks, model selection |
| `ImageGalleryContext` | Saving/retrieving generated images |
| `ImageViewerContext` | Fullscreen image display |

### 3.2 Local State

- Feature-specific state lives in hooks
- Form inputs as `useState`
- Loading/error states per operation
- No global state library (Redux/Zustand)

### 3.3 Derived State

Compute in render or useMemo, not separate state:
```typescript
// Good
const validItems = items.filter(item => item.image !== null);

// Avoid
const [validItems, setValidItems] = useState([]);
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
  setError(null);
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
    // Check for known error keys
    if (err.message.startsWith('error.')) {
      return t(err.message);
    }
    return err.message;
  }
  return t('error.unknown');
};
```

### 5.3 Validation Before API Calls

```typescript
if (!subjectImage || validClothingItems.length === 0) {
  setError(t('virtualTryOn.inputError'));
  return;
}
if (requiresAivideoauto && !aivideoautoAccessToken) {
  setError(t('error.api.aivideoautoAuth'));
  return;
}
```

## 6. Service Layer Pattern

### 6.1 Unified Facade

`imageEditingService.ts` routes based on model prefix:

```typescript
export const editImage = async (params, model, config) => {
  if (model.startsWith('aivideoauto--')) {
    return aivideoautoService.createImage(...);
  }
  return geminiImageService.editImage(params);
};
```

### 6.2 Config Object

```typescript
interface ApiConfig {
  aivideoautoAccessToken?: string | null;
  onStatusUpdate: (message: string) => void;
  aivideoautoVideoModels?: AIVideoAutoModel[];
  aivideoautoImageModels?: AIVideoAutoModel[];
}
```

## 7. Pure Functions Pattern

### 7.1 Prompt Builders (DRY)

Extract complex prompt generation logic into pure functions in `utils/`:

```typescript
// utils/lookbookPromptBuilder.ts

/**
 * Form state interface - single source of truth
 */
export interface LookbookFormState {
  clothingImages: Array<{ id: number; image: ImageFile | null }>;
  fabricTextureImage: ImageFile | null;
  lookbookStyle: LookbookStyle;
  garmentType: GarmentType;
  // ...other fields
}

/**
 * Build main lookbook prompt
 * Pure function - deterministic output, no side effects
 */
export const buildLookbookPrompt = (
  formState: LookbookFormState,
  images: ImageFile[],
  fabricTextureImage: ImageFile | null
): string => {
  const { lookbookStyle, garmentType } = formState;

  let prompt = '';
  // Prompt construction logic...

  switch (lookbookStyle) {
    case 'flat lay':
      prompt += buildFlatLayPrompt(garmentType);
      break;
    // ...other cases
  }

  return prompt;
};

// Private helper functions
const buildFlatLayPrompt = (garmentType: GarmentType): string => {
  // Style-specific prompt logic
};
```

**Benefits:**
- **Testable:** Pure functions are easy to unit test
- **Reusable:** Can be used across components/hooks
- **DRY:** Single source of truth for form state interface
- **Maintainable:** Logic separated from UI concerns

### 7.2 Interface as Contract

Use a shared interface exported from the builder as the contract between components:

```typescript
// LookbookForm.tsx imports and uses the interface
import { LookbookFormState } from '../utils/lookbookPromptBuilder';

interface LookbookFormProps {
  formState: LookbookFormState;
  onFormChange: (updates: Partial<LookbookFormState>) => void;
}

// LookbookGenerator.tsx uses the same interface
const [formState, setFormState] = useState<LookbookFormState>(initialFormState);
```

This ensures **consistency** and prevents drift between components.

## 8. i18n Pattern

### 8.1 Translation Keys

```typescript
// locales/en.ts
export const en = {
  virtualTryOn: {
    title: 'Virtual Try-On',
    inputError: 'Please upload a subject image and at least one clothing item.',
    generatingStatus: 'Generating virtual try-on...',
  },
  error: {
    api: {
      aivideoautoAuth: 'AIVideoAuto authentication required.',
    },
    unknown: 'An unexpected error occurred.',
  },
};
```

### 8.2 Usage

```typescript
const { t } = useLanguage();
<h1>{t('virtualTryOn.title')}</h1>
```

## 9. Testing Conventions

- Framework: Vitest
- Component tests: React Testing Library
- Service mocks: vi.mock()
- Test file location: Co-located or `__tests__/` directory
- Coverage goals: 80%+ for services, 90%+ for contexts

## 10. Performance Optimization Patterns

### 10.1 Component Memoization

Use `React.memo` for components that re-render frequently with same props:

```typescript
const ImageUploader: React.FC<ImageUploaderProps> = React.memo(({ image, onImageUpload, title, id }) => {
  // Component logic
});

ImageUploader.displayName = 'ImageUploader';
```

**Example: LookbookForm/Output Split Pattern**

When a parent component has independent form and output sections, split them and memoize each:

```typescript
// LookbookForm.tsx - Memoized form component
export const LookbookForm = React.memo<LookbookFormProps>(({
  formState,
  onFormChange,
  onGenerate,
  // ...other props
}) => {
  // Memoized event handlers
  const handleStyleChange = useCallback((style: LookbookStyle) => {
    onFormChange({ lookbookStyle: style });
  }, [onFormChange]);

  return (/* form UI */);
});

LookbookForm.displayName = 'LookbookForm';

// LookbookOutput.tsx - Memoized output component
export const LookbookOutput = React.memo<LookbookOutputProps>(({
  lookbook,
  onUpscale,
  // ...other props
}) => {
  return (/* output UI */);
});

LookbookOutput.displayName = 'LookbookOutput';

// LookbookGenerator.tsx - Orchestrator (thin coordinator)
export const LookbookGenerator: React.FC = () => {
  const [formState, setFormState] = useState<LookbookFormState>(initialFormState);
  const [generatedLookbook, setGeneratedLookbook] = useState<LookbookSet | null>(null);

  const updateForm = useCallback((updates: Partial<LookbookFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <div className="grid grid-cols-2 gap-8">
      <LookbookForm formState={formState} onFormChange={updateForm} onGenerate={handleGenerate} />
      <LookbookOutput lookbook={generatedLookbook} onUpscale={handleUpscale} />
    </div>
  );
};
```

**Benefits:**
- Form changes don't re-render output component
- Output updates don't re-render form component
- Clear separation of concerns (SoC)
- Easier testing and maintenance

### 10.2 Hook Optimization

Combine `useMemo` and `useCallback` to prevent unnecessary re-renders:

```typescript
// Memoize expensive calculations
const preview = useMemo(
  () => (image ? `data:${image.mimeType};base64,${image.base64}` : null),
  [image?.base64, image?.mimeType]
);

// Memoize event handlers passed to memoized children
const handleClick = useCallback(() => {
  onAction(data);
}, [onAction, data]);
```

**Critical:** When using `React.memo`, all props must be stable (memoized with `useCallback`/`useMemo`) to prevent memo bypasses.

### 10.3 Debounced localStorage

For form auto-save, use debounced writes to prevent UI lag:

```typescript
import debounce from 'lodash-es/debounce';

const debouncedSave = useMemo(
  () => debounce((state) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, 1000),
  []
);

useEffect(() => {
  debouncedSave(formState);
  return () => debouncedSave.cancel(); // Cleanup
}, [formState, debouncedSave]);
```

### 10.4 Lazy Loading

Use `React.lazy` with unique `key` props for code splitting:

```typescript
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// In render
<Suspense fallback={<Spinner />}>
  <HeavyComponent key="unique-key" />
</Suspense>
```

### 10.5 Tree-Shakeable Imports

Use `lodash-es` for tree-shaking support:

```typescript
// ✅ Good: Tree-shakeable
import debounce from 'lodash-es/debounce';

// ❌ Bad: Imports entire library
import { debounce } from 'lodash';
```

**See:** [`docs/performance-optimization.md`](./performance-optimization.md) for detailed performance patterns and metrics.

---

## 11. Desktop Development (Tauri)

- Native calls should be abstracted in `services/tauriService.ts`
- Use `isTauri()` utility to gate native-only logic
- Prefer `@tauri-apps/plugin-*` for common tasks (fs, shell, notification)
