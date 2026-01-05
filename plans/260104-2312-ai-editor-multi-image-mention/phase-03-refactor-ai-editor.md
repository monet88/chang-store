# Phase 03: Refactor Inpainting → AIEditor

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: Phase 01 (MentionTextarea), Phase 02 (Tag Overlay)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 1.5h
- **Description:** Transform Inpainting.tsx → AIEditor.tsx, remove mask tools, add multi-image support

## Key Insights
- Remove ALL mask-related code (540 lines → ~200 lines)
- Keep: ImageOptionsPanel, result display, error handling, API integration
- Add: MultiImageUploader, MentionTextarea
- Change prompt engineering for multi-image

## Requirements

### Functional
- Upload multiple images (no limit)
- Mention images in prompt with @img1, @img2
- Extract mentioned images and send to API
- Display single result image

### Non-Functional
- Follow existing component patterns
- Memoize where appropriate

## Architecture

**Before (Inpainting.tsx):**
```
- Single image upload
- Mask canvas layers (image, drawing, cursor, mask)
- Tools: rectangle, brush, eraser
- Prompt with mask instructions
```

**After (AIEditor.tsx):**
```
- MultiImageUploader (multiple images)
- MentionTextarea (prompt with @mentions)
- ImageOptionsPanel (reuse)
- Result display (HoverableImage)
```

**State comparison:**
```typescript
// Before (Inpainting)
const [image, setImage] = useState<ImageFile | null>(null);
const [activeTool, setActiveTool] = useState<Tool>('rectangle');
const [brushSize, setBrushSize] = useState(40);
// ... 15+ mask-related states

// After (AIEditor)
const [images, setImages] = useState<ImageFile[]>([]);
const [prompt, setPrompt] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [resultImage, setResultImage] = useState<ImageFile | null>(null);
const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
```

## Related Code Files

### Files to Create
| File | Purpose |
|------|---------|
| `components/AIEditor.tsx` | New component (replacing Inpainting) |

### Files to Delete
| File | Reason |
|------|--------|
| `components/Inpainting.tsx` | Replaced by AIEditor |

### Dependencies (Existing)
| File | Usage |
|------|-------|
| `components/MultiImageUploader.tsx` | Multi-image upload |
| `components/MentionTextarea.tsx` | Prompt with mentions (Phase 01) |
| `components/ImageOptionsPanel.tsx` | Aspect ratio, resolution |
| `components/HoverableImage.tsx` | Result display |
| `services/imageEditingService.ts` | API calls |

## Implementation Steps

### Step 1: Create AIEditor.tsx skeleton
```typescript
import React, { useState, useCallback } from 'react';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';
import MultiImageUploader from './MultiImageUploader';
import MentionTextarea from './MentionTextarea';
import ImageOptionsPanel from './ImageOptionsPanel';
import HoverableImage from './HoverableImage';
import Spinner, { ErrorDisplay } from './Spinner';
import { GalleryIcon } from './Icons';

const AIEditor: React.FC = () => {
  const { t } = useLanguage();
  const { getModelsForFeature, aivideoautoAccessToken, aivideoautoImageModels } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.AIEditor);

  // State
  const [images, setImages] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<ImageFile | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  // ... implementation
};

export default AIEditor;
```

### Step 2: Add mention extraction utility
```typescript
const MENTION_REGEX = /@img(\d+)/g;

/**
 * Extract mentioned images from prompt
 * Returns unique images in mention order
 */
const extractMentionedImages = useCallback((promptText: string): ImageFile[] => {
  const matches = [...promptText.matchAll(MENTION_REGEX)];
  const indices = [...new Set(matches.map(m => parseInt(m[1]) - 1))];
  return indices
    .filter(i => i >= 0 && i < images.length)
    .map(i => images[i]);
}, [images]);
```

### Step 3: Build API prompt with image roles
```typescript
const buildApiPrompt = useCallback((userPrompt: string, mentionedImages: ImageFile[]): string => {
  if (mentionedImages.length === 0) {
    // Fallback: use all images
    return `# INSTRUCTION: IMAGE EDITING

## USER REQUEST:
${userPrompt}

## OUTPUT:
Return the edited image as the final result.`;
  }

  // Build image roles
  const imageRoles = mentionedImages.map((_, idx) => {
    const tag = `@img${images.indexOf(mentionedImages[idx]) + 1}`;
    return `- Image ${idx + 1} (${tag}): Reference image`;
  }).join('\n');

  return `# INSTRUCTION: MULTI-IMAGE EDITING

## IMAGE ROLES:
${imageRoles}

## USER REQUEST:
${userPrompt}

## CRITICAL RULES:
1. Analyze all provided images based on the user's request
2. Apply edits as described, using referenced images appropriately
3. Maintain image quality and natural appearance

## OUTPUT:
Return the final edited image.`;
}, [images]);
```

### Step 4: Generate handler
```typescript
const handleGenerate = async () => {
  if (images.length === 0) {
    setError(t('aiEditor.error.noImages'));
    return;
  }
  if (!prompt.trim()) {
    setError(t('aiEditor.error.noPrompt'));
    return;
  }

  // Check API auth
  if (imageEditModel.startsWith('aivideoauto--') && !aivideoautoAccessToken) {
    setError(t('error.api.aivideoautoAuth'));
    return;
  }

  setIsLoading(true);
  setError(null);

  try {
    // Extract mentioned images or use all
    const mentionedImages = extractMentionedImages(prompt);
    const imagesToSend = mentionedImages.length > 0 ? mentionedImages : images;
    const apiPrompt = buildApiPrompt(prompt, imagesToSend);

    const [result] = await editImage(
      {
        images: imagesToSend,
        prompt: apiPrompt,
        numberOfImages: 1,
        aspectRatio,
        resolution,
      },
      imageEditModel,
      {
        onStatusUpdate: () => {},
        aivideoautoAccessToken,
        aivideoautoImageModels,
      }
    );

    setResultImage(result);
  } catch (err) {
    setError(getErrorMessage(err, t));
  } finally {
    setIsLoading(false);
  }
};
```

### Step 5: Render UI
```tsx
return (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start overflow-x-hidden pb-12">
    {/* Left Column: Inputs */}
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold mb-1">{t('aiEditor.title')}</h2>
        <p className="text-zinc-400 max-w-lg mx-auto">{t('aiEditor.description')}</p>
      </div>

      {/* Multi-image uploader */}
      <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <MultiImageUploader
          images={images}
          onImagesUpload={setImages}
          title={t('aiEditor.uploadTitle')}
          id="ai-editor-upload"
        />
      </div>

      {/* Prompt with mentions */}
      <div>
        <MentionTextarea
          value={prompt}
          onChange={setPrompt}
          images={images}
          placeholder={t('aiEditor.promptPlaceholder')}
          id="ai-editor-prompt"
        />
      </div>

      {/* Options */}
      <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <ImageOptionsPanel
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          resolution={resolution}
          setResolution={setResolution}
          model={imageEditModel}
        />
      </div>

      {/* Generate button */}
      <div className="text-center">
        <button
          onClick={handleGenerate}
          disabled={isLoading || images.length === 0}
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30"
        >
          {isLoading ? <Spinner /> : t('aiEditor.generateButton')}
        </button>
      </div>
    </div>

    {/* Right Column: Output */}
    <div className="lg:sticky lg:top-8">
      <div className="relative w-full min-h-[400px] lg:aspect-[4/5] bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center p-4">
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-zinc-400">{t('aiEditor.generatingStatus')}</p>
          </div>
        )}

        {!isLoading && resultImage && (
          <HoverableImage
            image={resultImage}
            altText="AI Editor result"
            onRegenerate={handleGenerate}
            isGenerating={isLoading}
          />
        )}

        {!isLoading && !resultImage && !error && (
          <div className="text-center text-zinc-500">
            <GalleryIcon className="mx-auto h-16 w-16" />
            <h3 className="mt-4 text-base font-semibold text-zinc-400">
              {t('common.outputPanelTitle')}
            </h3>
          </div>
        )}

        {error && !isLoading && (
          <ErrorDisplay
            title={t('common.generationFailed')}
            message={error}
            onClear={() => setError(null)}
          />
        )}
      </div>
    </div>
  </div>
);
```

### Step 6: Delete Inpainting.tsx
```bash
rm components/Inpainting.tsx
```

## Todo List

- [ ] Create `components/AIEditor.tsx`
- [ ] Implement state management
- [ ] Add mention extraction utility
- [ ] Implement prompt building
- [ ] Implement generate handler
- [ ] Render UI with MultiImageUploader + MentionTextarea
- [ ] Delete `components/Inpainting.tsx`
- [ ] Test end-to-end

## Success Criteria

- [ ] Component renders without errors
- [ ] Multi-image upload works
- [ ] Mention insertion works
- [ ] API call sends correct images
- [ ] Result displays correctly
- [ ] Error handling works

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing inpainting users | Feature completely replaced, no migration needed |
| API prompt format changes | Keep prompt format similar to existing patterns |

## Security Considerations
- Validate image count before API call
- Sanitize prompt for API (no injection risk with current format)

## Next Steps
- Phase 04: Update types and translations
