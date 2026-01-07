# Phase 1: Foundation

**Estimated**: 2 hours

## Tasks

### 1.1 Install jszip dependency

```bash
npm install jszip
```

### 1.2 Create utils/watermark-prompts.ts

```typescript
/**
 * Watermark Remover - Predefined prompts and model options
 */

/** Available Gemini models for watermark removal */
export const WATERMARK_MODELS = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image' },
] as const;

export type WatermarkModel = typeof WATERMARK_MODELS[number]['id'];

/** Predefined prompts for watermark removal */
export const WATERMARK_PROMPTS = [
  {
    id: 'text-logo',
    name: 'Text & Logo Removal',
    prompt: 'Remove all text, logos, and graphical overlays from this image. Fill the removed areas with background-appropriate content that matches the surrounding style, colors, and textures seamlessly.',
  },
  {
    id: 'clean',
    name: 'Clean Version',
    prompt: 'A clean version of this image without any written text, symbols, or branding elements. Naturally extend the background or pattern to replace removed objects.',
  },
  {
    id: 'safe',
    name: 'Safe & Neutral',
    prompt: 'Keep the original composition and style. Only remove text and graphic elements that are not part of the main scene. Fill gaps with matching visual content.',
  },
  {
    id: 'artistic',
    name: 'Artistic/Pattern',
    prompt: 'Remove all non-decorative text and logos. Regenerate the underlying design, pattern, or texture to cover removed areas while maintaining artistic harmony.',
  },
  {
    id: 'quick',
    name: 'Quick & Simple',
    prompt: 'Erase text and logos. Fill with matching background.',
  },
] as const;

export type WatermarkPromptId = typeof WATERMARK_PROMPTS[number]['id'];

/** Get prompt text by ID, or return custom prompt */
export function getPromptText(promptId: WatermarkPromptId | 'custom', customPrompt?: string): string {
  if (promptId === 'custom') {
    return customPrompt || '';
  }
  const found = WATERMARK_PROMPTS.find(p => p.id === promptId);
  return found?.prompt || '';
}
```

### 1.3 Create utils/zipDownload.ts

```typescript
/**
 * ZIP download utility using JSZip
 */
import JSZip from 'jszip';
import type { ImageFile } from '@/types';

/**
 * Download multiple images as a ZIP file
 * @param images - Array of ImageFile objects to include
 * @param zipFilename - Name for the ZIP file (without extension)
 */
export async function downloadImagesAsZip(
  images: ImageFile[],
  zipFilename: string = 'watermark-removed'
): Promise<void> {
  const zip = new JSZip();

  // Add each image to the ZIP
  images.forEach((image, index) => {
    // Extract base64 data from data URL
    const base64Data = image.data.split(',')[1];
    const extension = image.mimeType.split('/')[1] || 'png';
    const filename = image.name || `image-${index + 1}.${extension}`;
    
    zip.file(filename, base64Data, { base64: true });
  });

  // Generate and download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${zipFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
```

### 1.4 Update types.ts

Add the following types:

```typescript
/** Watermark batch processing item */
export interface WatermarkBatchItem {
  /** Unique identifier */
  id: string;
  /** Original uploaded image */
  original: ImageFile;
  /** Processing status */
  status: 'pending' | 'processing' | 'success' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Result image after processing */
  result?: ImageFile;
  /** Error message if failed */
  error?: string;
  /** Prompt used for this item */
  promptUsed: string;
}

/** Watermark remover configuration */
export interface WatermarkConfig {
  /** Selected Gemini model */
  model: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
  /** Selected prompt ID or 'custom' */
  promptId: string;
  /** Custom prompt text (when promptId is 'custom') */
  customPrompt: string;
  /** Number of parallel requests */
  concurrency: number;
}
```

## Checklist

- [ ] Run `npm install jszip`
- [ ] Create `utils/watermark-prompts.ts`
- [ ] Create `utils/zipDownload.ts`
- [ ] Add types to `types.ts`
- [ ] Verify no TypeScript errors
