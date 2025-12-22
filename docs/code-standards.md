# Chang-Store: Code Standards

**Last Updated:** 2025-12-22

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

## 7. i18n Pattern

### 7.1 Translation Keys

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

### 7.2 Usage

```typescript
const { t } = useLanguage();
<h1>{t('virtualTryOn.title')}</h1>
```

## 8. Testing Conventions

- Framework: Vitest
- Component tests: React Testing Library
- Service mocks: vi.mock()
- Test file location: Co-located or `__tests__/` directory
