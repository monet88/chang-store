# Phase 02a: Split LookbookGenerator

**Agent Type:** fullstack-developer
**Priority:** P0 Critical
**Estimated Time:** 1-2 days
**Issue Reference:** ISSUE 2 from performance report
**Dependencies:** Requires Phase 1 completion

---

## Objective

Split 954-line LookbookGenerator monolith into 4 modular files to eliminate 12-20ms render lag and improve maintainability.

**Target Structure:**
- `LookbookGenerator.tsx` (orchestrator, ~150 lines)
- `LookbookForm.tsx` (form UI, ~300 lines, memoized)
- `LookbookOutput.tsx` (output display, ~200 lines, memoized)
- `lookbookPromptBuilder.ts` (prompt logic, ~350 lines, pure function)

**Performance Impact:**
- Render time: 12-20ms → 2-5ms per interaction
- Code maintainability: 954 lines → 4 focused modules
- Re-render isolation: Form changes don't trigger output re-renders

---

## Current Problem

```typescript
// components/LookbookGenerator.tsx:57-953 (897 lines)
export const LookbookGenerator: React.FC = () => {
  // ❌ 15 useState hooks - massive re-render surface area
  const [formState, setFormState] = useState<LookbookFormState>(/* ... */);
  const [generatedLookbook, setGeneratedLookbook] = useState<LookbookSet | null>(null);
  const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});
  // ... 12 more

  // ❌ 350+ lines of inline prompt generation logic
  const handleGenerate = async () => {
    let stylePrompt = '';
    switch (lookbookStyle) {
      case 'folded': {
        const basePrompt = foldedPresentationType === 'boxed' ? BOXED_PROMPT : FOLDED_PROMPT;
        // ... 200 lines of prompt construction
      }
      // ... more cases
    }
  };

  // ❌ Mixed concerns: form UI, output UI, business logic all in one file
  return (
    <div>
      {/* 300 lines of form JSX */}
      {/* 200 lines of output JSX */}
    </div>
  );
};
```

---

## Implementation Plan

### Step 1: Extract Prompt Builder (Pure Function)

**File:** `utils/lookbookPromptBuilder.ts` (~350 lines)

```typescript
import {
  BOXED_PROMPT,
  FOLDED_PROMPT,
  MANNEQUIN_BACKGROUND_PROMPTS,
  LookbookStyle,
  FoldedPresentationType,
  MannequinBackgroundStyleKey
} from '../components/LookbookGenerator.prompts';
import { LookbookFormState } from '../hooks/useLookbookGenerator';
import { ImageFile } from '../types';

/**
 * Builds the main lookbook generation prompt based on form state
 * Pure function - no side effects, deterministic output
 */
export const buildLookbookPrompt = (
  formState: LookbookFormState,
  images: ImageFile[],
  fabricTextureImage: ImageFile | null
): string => {
  const {
    lookbookStyle,
    foldedPresentationType,
    garmentType,
    mannequinBackgroundStyle,
    clothingDescription,
    fabricTexturePrompt
  } = formState;

  let prompt = '';

  // Multi-image synthesis instruction
  if (images.length > (fabricTextureImage ? 2 : 1)) {
    prompt += `
      **Image Roles**: Multiple images of the same clothing item are provided, showing different angles (e.g., front, side, back).
      **Core Synthesis Task**: Your primary goal is to mentally reconstruct a complete, 3D understanding of the single garment from these multiple 2D views. Synthesize all details—shape, seams, texture, pattern flow, and features—into one cohesive object. The final output should feature this synthesized garment.
    `;
  } else {
    prompt += `
      **Image Role**: A single image of a clothing item is provided.
    `;
  }

  // Fabric texture section
  let fabricPromptSection = '';
  if (fabricTextureImage) {
    fabricPromptSection += `
      **Reference Fabric Texture**: An additional image showing a fabric texture/pattern is provided as a reference.
      **Texture Integration Task**: Study the texture/pattern from this reference image carefully. When generating the lookbook presentation, ensure that the garment is rendered with this EXACT texture/pattern applied to its surface. The pattern should:
      - Follow the garment's form and contours naturally
      - Respect seams and structural divisions
      - Maintain proper scale and orientation
      - Look as if the garment was actually made from this fabric
    `;
    if (fabricTexturePrompt.trim()) {
      fabricPromptSection += `\n**Additional Fabric Instructions**: ${fabricTexturePrompt.trim()}`;
    }
  }
  prompt += fabricPromptSection;

  // Style-specific prompt generation
  let stylePrompt = '';
  switch (lookbookStyle) {
    case 'flat lay':
      stylePrompt = buildFlatLayPrompt(formState);
      break;
    case 'folded':
      stylePrompt = buildFoldedPrompt(formState);
      break;
    case 'mannequin':
      stylePrompt = buildMannequinPrompt(formState);
      break;
    case 'hanger':
      stylePrompt = buildHangerPrompt(formState);
      break;
    case 'lifestyle':
      stylePrompt = buildLifestylePrompt(formState);
      break;
    default:
      stylePrompt = buildFlatLayPrompt(formState);
  }

  prompt += `\n\n${stylePrompt}`;

  // Clothing description section
  if (clothingDescription.trim()) {
    prompt += `\n\n**Garment Description**: ${clothingDescription.trim()}`;
  }

  return prompt;
};

/**
 * Build flat lay style prompt
 */
const buildFlatLayPrompt = (formState: LookbookFormState): string => {
  // Extract from original handleGenerate logic (lines ~150-180)
  return `
    **Presentation Style**: Flat Lay
    **Scene**: The garment is laid out perfectly flat on a clean, professional surface...
    [Copy existing flat lay prompt logic]
  `;
};

/**
 * Build folded style prompt
 */
const buildFoldedPrompt = (formState: LookbookFormState): string => {
  const { foldedPresentationType } = formState;
  const basePrompt = foldedPresentationType === 'boxed' ? BOXED_PROMPT : FOLDED_PROMPT;
  return basePrompt; // May need additional logic based on original code
};

/**
 * Build mannequin style prompt
 */
const buildMannequinPrompt = (formState: LookbookFormState): string => {
  const { mannequinBackgroundStyle } = formState;
  return MANNEQUIN_BACKGROUND_PROMPTS[mannequinBackgroundStyle];
};

/**
 * Build hanger style prompt
 */
const buildHangerPrompt = (formState: LookbookFormState): string => {
  // Extract from original logic
  return `
    **Presentation Style**: Hanger Display
    [Copy existing hanger prompt logic]
  `;
};

/**
 * Build lifestyle style prompt
 */
const buildLifestylePrompt = (formState: LookbookFormState): string => {
  // Extract from original logic
  return `
    **Presentation Style**: Lifestyle Context
    [Copy existing lifestyle prompt logic]
  `;
};

/**
 * Build variation generation prompt
 */
export const buildVariationPrompt = (lookbookStyle: LookbookStyle): string => {
  // Extract from handleGenerateVariations logic
  return `
    Generate a subtle variation of this lookbook image...
    [Copy existing variation prompt logic]
  `;
};

/**
 * Build close-up generation prompts
 */
export const buildCloseUpPrompts = (): string[] => {
  // Extract from handleGenerateCloseUp logic
  return [
    'fabric texture close-up prompt...',
    'stitching detail close-up prompt...',
    // ... other close-up prompts
  ];
};
```

**Migration Strategy:**
1. Copy all prompt generation logic from LookbookGenerator.tsx
2. Convert to pure functions (no state, no side effects)
3. Add JSDoc comments for each function
4. Export all needed functions

---

### Step 2: Extract Form Component

**File:** `components/LookbookForm.tsx` (~300 lines)

```typescript
import React, { useCallback } from 'react';
import { LookbookFormState, ClothingItem } from '../hooks/useLookbookGenerator';
import { ImageFile } from '../types';
import ImageUploader from './ImageUploader';
import { useLanguage } from '../contexts/LanguageContext';

interface LookbookFormProps {
  formState: LookbookFormState;
  onFormChange: (updates: Partial<LookbookFormState>) => void;
  onGenerateDescription: () => void;
  onGenerate: () => void;
  isGeneratingDescription: boolean;
  isLoading: boolean;
}

/**
 * LookbookForm - Form UI for lookbook generation
 * Memoized to prevent re-renders when output changes
 */
export const LookbookForm = React.memo<LookbookFormProps>(({
  formState,
  onFormChange,
  onGenerateDescription,
  onGenerate,
  isGeneratingDescription,
  isLoading
}) => {
  const { t } = useLanguage();

  // Memoized handlers
  const handleClothingImageUpload = useCallback((index: number, image: ImageFile) => {
    const newClothingImages = [...formState.clothingImages];
    newClothingImages[index].image = image;
    onFormChange({ clothingImages: newClothingImages });
  }, [formState.clothingImages, onFormChange]);

  const handleAddClothingImage = useCallback(() => {
    onFormChange({
      clothingImages: [...formState.clothingImages, { id: Date.now(), image: null }]
    });
  }, [formState.clothingImages, onFormChange]);

  const handleRemoveClothingImage = useCallback((id: number) => {
    onFormChange({
      clothingImages: formState.clothingImages.filter(item => item.id !== id)
    });
  }, [formState.clothingImages, onFormChange]);

  const handleFabricTextureUpload = useCallback((image: ImageFile) => {
    onFormChange({ fabricTextureImage: image });
  }, [onFormChange]);

  const handleStyleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onFormChange({ lookbookStyle: e.target.value as any });
  }, [onFormChange]);

  // ... more handlers

  return (
    <div className="lookbook-form">
      <h2 className="text-2xl font-bold mb-4">{t('lookbook.title')}</h2>

      {/* Clothing Images Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          {t('lookbook.clothingImages')}
        </label>
        {formState.clothingImages.map((item, index) => (
          <div key={item.id} className="mb-4 flex items-start gap-4">
            <ImageUploader
              image={item.image}
              onImageUpload={(img) => handleClothingImageUpload(index, img)}
              title={`${t('lookbook.clothingImage')} ${index + 1}`}
              id={`clothing-${item.id}`}
            />
            {formState.clothingImages.length > 1 && (
              <button
                onClick={() => handleRemoveClothingImage(item.id)}
                className="btn-secondary"
              >
                {t('common.remove')}
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddClothingImage}
          className="btn-primary"
        >
          {t('lookbook.addImage')}
        </button>
      </div>

      {/* Style Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          {t('lookbook.style')}
        </label>
        <select
          value={formState.lookbookStyle}
          onChange={handleStyleChange}
          className="select"
        >
          <option value="flat lay">{t('lookbook.styles.flatLay')}</option>
          <option value="folded">{t('lookbook.styles.folded')}</option>
          <option value="mannequin">{t('lookbook.styles.mannequin')}</option>
          <option value="hanger">{t('lookbook.styles.hanger')}</option>
          <option value="lifestyle">{t('lookbook.styles.lifestyle')}</option>
        </select>
      </div>

      {/* Conditional style-specific options */}
      {/* ... more form fields */}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="btn-primary w-full"
      >
        {isLoading ? t('common.generating') : t('lookbook.generate')}
      </button>
    </div>
  );
});

LookbookForm.displayName = 'LookbookForm';
```

**Key Points:**
- Wrap with React.memo
- All handlers use useCallback
- Receives formState and callbacks as props
- No business logic (only UI and event handling)

---

### Step 3: Extract Output Component

**File:** `components/LookbookOutput.tsx` (~200 lines)

```typescript
import React, { useCallback } from 'react';
import { LookbookSet } from '../hooks/useLookbookGenerator';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import Spinner from './Spinner';

interface LookbookOutputProps {
  lookbook: LookbookSet | null;
  activeTab: 'main' | 'variations' | 'closeup';
  onTabChange: (tab: 'main' | 'variations' | 'closeup') => void;
  onUpscale: (image: ImageFile, key: string) => void;
  onGenerateVariations: () => void;
  onGenerateCloseUp: () => void;
  upscalingStates: Record<string, boolean>;
  isGeneratingVariations: boolean;
  isGeneratingCloseUp: boolean;
  variationCount: number;
  onVariationCountChange: (count: number) => void;
}

/**
 * LookbookOutput - Display generated lookbook images with tabs
 * Memoized to prevent re-renders when form changes
 */
export const LookbookOutput = React.memo<LookbookOutputProps>(({
  lookbook,
  activeTab,
  onTabChange,
  onUpscale,
  onGenerateVariations,
  onGenerateCloseUp,
  upscalingStates,
  isGeneratingVariations,
  isGeneratingCloseUp,
  variationCount,
  onVariationCountChange
}) => {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();

  const handleSaveToGallery = useCallback((image: ImageFile) => {
    addImage(image);
  }, [addImage]);

  if (!lookbook) {
    return (
      <div className="lookbook-output-empty text-center p-8">
        <p className="text-slate-400">{t('lookbook.noOutput')}</p>
      </div>
    );
  }

  const renderImage = (image: ImageFile, imageKey: string) => (
    <div key={imageKey} className="lookbook-image-card">
      <img
        src={`data:${image.mimeType};base64,${image.base64}`}
        alt="Lookbook"
        className="w-full rounded-lg"
      />
      <div className="image-actions mt-2 flex gap-2">
        <button
          onClick={() => onUpscale(image, imageKey)}
          disabled={upscalingStates[imageKey]}
          className="btn-secondary"
        >
          {upscalingStates[imageKey] ? t('common.upscaling') : t('common.upscale')}
        </button>
        <button
          onClick={() => handleSaveToGallery(image)}
          className="btn-secondary"
        >
          {t('common.saveToGallery')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="lookbook-output">
      {/* Tabs */}
      <div className="tabs mb-4">
        <button
          onClick={() => onTabChange('main')}
          className={activeTab === 'main' ? 'tab-active' : 'tab'}
        >
          {t('lookbook.tabs.main')}
        </button>
        <button
          onClick={() => onTabChange('variations')}
          className={activeTab === 'variations' ? 'tab-active' : 'tab'}
        >
          {t('lookbook.tabs.variations')} ({lookbook.variations.length})
        </button>
        <button
          onClick={() => onTabChange('closeup')}
          className={activeTab === 'closeup' ? 'tab-active' : 'tab'}
        >
          {t('lookbook.tabs.closeup')} ({lookbook.closeups.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'main' && (
          <div>
            {renderImage(lookbook.main, 'main')}
            <div className="mt-4 flex gap-2">
              <button onClick={onGenerateVariations} className="btn-primary">
                {t('lookbook.generateVariations')}
              </button>
              <button onClick={onGenerateCloseUp} className="btn-primary">
                {t('lookbook.generateCloseUp')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'variations' && (
          <div>
            {isGeneratingVariations ? (
              <Spinner />
            ) : lookbook.variations.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {lookbook.variations.map((img, idx) =>
                  renderImage(img, `variation-${idx}`)
                )}
              </div>
            ) : (
              <p className="text-slate-400">{t('lookbook.noVariations')}</p>
            )}
          </div>
        )}

        {activeTab === 'closeup' && (
          <div>
            {isGeneratingCloseUp ? (
              <Spinner />
            ) : lookbook.closeups.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {lookbook.closeups.map((img, idx) =>
                  renderImage(img, `closeup-${idx}`)
                )}
              </div>
            ) : (
              <p className="text-slate-400">{t('lookbook.noCloseups')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

LookbookOutput.displayName = 'LookbookOutput';
```

---

### Step 4: Refactor Main Orchestrator

**File:** `components/LookbookGenerator.tsx` (~150 lines)

```typescript
import React from 'react';
import { useLookbookGenerator } from '../hooks/useLookbookGenerator';
import { LookbookForm } from './LookbookForm';
import { LookbookOutput } from './LookbookOutput';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * LookbookGenerator - Main orchestrator component
 * Delegates UI to Form and Output, manages state via hook
 */
export const LookbookGenerator: React.FC = () => {
  const { t } = useLanguage();
  const {
    formState,
    updateForm,
    generatedLookbook,
    isLoading,
    loadingMessage,
    isGeneratingDescription,
    isGeneratingVariations,
    isGeneratingCloseUp,
    error,
    setError,
    variationCount,
    setVariationCount,
    activeOutputTab,
    setActiveOutputTab,
    upscalingStates,
    handleGenerateDescription,
    handleGenerate,
    handleUpscale,
    handleGenerateVariations,
    handleGenerateCloseUp,
  } = useLookbookGenerator();

  return (
    <div className="lookbook-generator grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Form */}
      <div>
        <LookbookForm
          formState={formState}
          onFormChange={updateForm}
          onGenerateDescription={handleGenerateDescription}
          onGenerate={handleGenerate}
          isGeneratingDescription={isGeneratingDescription}
          isLoading={isLoading}
        />
      </div>

      {/* Right Column: Output */}
      <div>
        {error && (
          <div className="error-banner mb-4">
            {error}
          </div>
        )}
        {loadingMessage && (
          <div className="loading-banner mb-4">
            {loadingMessage}
          </div>
        )}
        <LookbookOutput
          lookbook={generatedLookbook}
          activeTab={activeOutputTab}
          onTabChange={setActiveOutputTab}
          onUpscale={handleUpscale}
          onGenerateVariations={handleGenerateVariations}
          onGenerateCloseUp={handleGenerateCloseUp}
          upscalingStates={upscalingStates}
          isGeneratingVariations={isGeneratingVariations}
          isGeneratingCloseUp={isGeneratingCloseUp}
          variationCount={variationCount}
          onVariationCountChange={setVariationCount}
        />
      </div>
    </div>
  );
};
```

---

### Step 5: Update Hook to Use Prompt Builder

**File:** `hooks/useLookbookGenerator.ts` (modify existing)

```typescript
import { buildLookbookPrompt, buildVariationPrompt, buildCloseUpPrompts } from '../utils/lookbookPromptBuilder';

// In handleGenerate function:
const handleGenerate = async () => {
  // ... validation logic

  const imagesForApi: ImageFile[] = validClothingImages.map(item => item.image as ImageFile);
  if (fabricTextureImage) {
    imagesForApi.push(fabricTextureImage);
  }

  // ✅ Use prompt builder instead of inline logic
  const prompt = buildLookbookPrompt(formState, imagesForApi, fabricTextureImage);

  try {
    const results = await editImage({
      images: imagesForApi,
      prompt,
      negativePrompt: formState.negativePrompt,
      numberOfImages: 1
    }, imageEditModel, buildImageServiceConfig(setLoadingMessage));

    if (results.length > 0) {
      setGeneratedLookbook({ main: results[0], variations: [], closeups: [] });
      setActiveOutputTab('main');
    }
  } catch (err) {
    setError(getErrorMessage(err, t));
  } finally {
    setIsLoading(false);
    setLoadingMessage('');
  }
};

// Similarly for handleGenerateVariations and handleGenerateCloseUp
```

---

## Files Modified/Created

**Created:**
- `utils/lookbookPromptBuilder.ts` (NEW, ~350 lines)
- `components/LookbookForm.tsx` (NEW, ~300 lines)
- `components/LookbookOutput.tsx` (NEW, ~200 lines)

**Modified:**
- `components/LookbookGenerator.tsx` (954 → ~150 lines)
- `hooks/useLookbookGenerator.ts` (update to use prompt builder)

---

## Implementation Checklist

- [ ] Create `utils/lookbookPromptBuilder.ts`
  - [ ] Extract all prompt generation logic
  - [ ] Convert to pure functions
  - [ ] Add JSDoc comments
  - [ ] Export buildLookbookPrompt, buildVariationPrompt, buildCloseUpPrompts
- [ ] Create `components/LookbookForm.tsx`
  - [ ] Extract all form UI
  - [ ] Wrap with React.memo
  - [ ] All handlers use useCallback
  - [ ] Add displayName
- [ ] Create `components/LookbookOutput.tsx`
  - [ ] Extract all output UI
  - [ ] Wrap with React.memo
  - [ ] All handlers use useCallback
  - [ ] Add displayName
- [ ] Update `components/LookbookGenerator.tsx`
  - [ ] Remove extracted code
  - [ ] Import Form and Output components
  - [ ] Pass props correctly
  - [ ] Verify layout matches original
- [ ] Update `hooks/useLookbookGenerator.ts`
  - [ ] Import prompt builder functions
  - [ ] Replace inline prompt logic with function calls
- [ ] Verify all imports resolved
- [ ] Verify no circular dependencies

---

## Testing Requirements

### Functional Testing
1. **Main Generation:**
   - Upload clothing images
   - Select style (flat lay, folded, mannequin, hanger, lifestyle)
   - Click generate
   - Verify lookbook appears in output

2. **Variations:**
   - Generate main lookbook
   - Click "Generate Variations"
   - Verify variations tab populated

3. **Close-ups:**
   - Generate main lookbook
   - Click "Generate Close-Up"
   - Verify closeup tab populated

4. **Upscaling:**
   - Click upscale on any image
   - Verify upscaled image replaces original

5. **Form Interactions:**
   - Add/remove clothing images
   - Upload fabric texture
   - Change all form fields
   - Verify state updates correctly

### Performance Testing
```bash
# React DevTools Profiler
# Before split: 12-20ms per form interaction
# After split: 2-5ms per form interaction (70% improvement)
```

### Code Quality
- [ ] No console errors or warnings
- [ ] All props properly typed
- [ ] ESLint passing
- [ ] No circular dependencies
- [ ] Prompt logic produces identical output

---

## Acceptance Criteria

✅ **LookbookGenerator split into 4 files**
✅ **LookbookForm memoized, no output re-renders on form change**
✅ **LookbookOutput memoized, no form re-renders on output change**
✅ **Prompt builder is pure function (testable)**
✅ **All features functional (generation, variations, closeups, upscaling)**
✅ **Performance improved: 12-20ms → 2-5ms**
✅ **Code maintainability improved**
✅ **No breaking changes to functionality**

---

## Rollback Plan

```bash
git checkout components/LookbookGenerator.tsx
git checkout hooks/useLookbookGenerator.ts
rm utils/lookbookPromptBuilder.ts
rm components/LookbookForm.tsx
rm components/LookbookOutput.tsx
```

---

**Status:** Ready for implementation
**Agent:** fullstack-developer-2a
**Prerequisites:** Phase 1 complete
