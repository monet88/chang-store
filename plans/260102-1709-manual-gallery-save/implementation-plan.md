# Manual Gallery Save Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace auto-save mechanism with manual "Save to Gallery" button on each generated image.

**Architecture:** HoverableImage gets built-in save functionality via ImageGalleryContext. Remove all `addImage()` calls after generate/upload. Add Toast for feedback. Add "Save All" for batch operations.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, existing ImageGalleryContext

---

## Task 1: Add i18n Keys

**Files:**
- Modify: `locales/en.ts`
- Modify: `locales/vi.ts`

**Step 1: Add English translations**

```typescript
// In imageActions section, add:
saveToGallery: 'Save to Gallery',
savedToGallery: 'Saved',
saveAllToGallery: 'Save All',
```

**Step 2: Add Vietnamese translations**

```typescript
// In imageActions section, add:
saveToGallery: 'Luu vao Gallery',
savedToGallery: 'Da luu',
saveAllToGallery: 'Luu tat ca',
```

**Step 3: Add toast messages (new section)**

English:
```typescript
toast: {
  imageSaved: 'Image saved to Gallery',
  imagesSaved: '{{count}} images saved to Gallery',
  alreadySaved: 'Image already in Gallery',
},
```

Vietnamese:
```typescript
toast: {
  imageSaved: 'Da luu anh vao Gallery',
  imagesSaved: 'Da luu {{count}} anh vao Gallery',
  alreadySaved: 'Anh da co trong Gallery',
},
```

**Step 4: Commit**

```bash
git add locales/en.ts locales/vi.ts
git commit -m "feat(i18n): add save to gallery translations"
```

---

## Task 2: Create Toast Component

**Files:**
- Create: `components/Toast.tsx`
- Modify: `App.tsx`

**Step 1: Create Toast component**

```typescript
// components/Toast.tsx
import React, { useEffect, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { CheckCircleIcon } from './Icons';

interface ToastMessage {
  id: number;
  message: string;
}

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} message={toast.message} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
      <CheckCircleIcon className="w-5 h-5 text-green-400" />
      <span className="text-sm">{message}</span>
    </div>
  );
};
```

**Step 2: Add ToastProvider to App.tsx**

Wrap the app content with ToastProvider (inside LanguageProvider, outside other providers).

**Step 3: Commit**

```bash
git add components/Toast.tsx App.tsx
git commit -m "feat(ui): add toast notification system"
```

---

## Task 3: Add Save Button to HoverableImage

**Files:**
- Modify: `components/HoverableImage.tsx`

**Step 1: Add imports and context**

```typescript
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useToast } from './Toast';
import { GalleryIcon } from './Icons';
```

**Step 2: Add save logic inside component**

```typescript
const { addImage, images } = useImageGallery();
const { showToast } = useToast();
const { t } = useLanguage();

const isSavedToGallery = images.some(img => img.base64 === image.base64);

const handleSaveToGallery = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSavedToGallery) return;
    addImage(image);
    showToast(t('toast.imageSaved'));
};
```

**Step 3: Add Save button to top-right group (before Edit button)**

```tsx
{/* Save to Gallery button */}
<button
    onClick={handleSaveToGallery}
    disabled={isSavedToGallery}
    className={`p-2 rounded-full transition-colors ${
        isSavedToGallery
            ? 'bg-green-600/70 text-white cursor-default'
            : 'bg-slate-900/50 text-white hover:bg-amber-600/80'
    }`}
    aria-label={isSavedToGallery ? t('imageActions.savedToGallery') : t('imageActions.saveToGallery')}
    title={isSavedToGallery ? t('imageActions.savedToGallery') : t('imageActions.saveToGallery')}
>
    <GalleryIcon className="w-5 h-5" />
</button>
```

**Step 4: Commit**

```bash
git add components/HoverableImage.tsx
git commit -m "feat(gallery): add save to gallery button on HoverableImage"
```

---

## Task 4: Remove Auto-Save from VirtualTryOn

**Files:**
- Modify: `components/VirtualTryOn.tsx`

**Step 1: Find and remove addImage call after upscale (around line 165)**

Remove or comment out the line:
```typescript
// addImage(upscaledImage); // REMOVE THIS
```

**Step 2: Remove unused addImage import if no longer needed**

Check if `addImage` from `useImageGallery()` is still used elsewhere in the file. If not, remove it from destructuring.

**Step 3: Commit**

```bash
git add components/VirtualTryOn.tsx
git commit -m "refactor(try-on): remove auto-save after generate"
```

---

## Task 5: Remove Auto-Save from BackgroundReplacer

**Files:**
- Modify: `components/BackgroundReplacer.tsx`

**Step 1: Remove addImage after background replace (line 218)**

**Step 2: Remove addImage on upload (lines 72, 78)**

**Step 3: Clean up unused imports**

**Step 4: Commit**

```bash
git add components/BackgroundReplacer.tsx
git commit -m "refactor(background): remove auto-save after generate and upload"
```

---

## Task 6: Remove Auto-Save from GRWMVideoGenerator

**Files:**
- Modify: `components/GRWMVideoGenerator.tsx`

**Step 1: Remove addImage after crop/compress (line 57)**

**Step 2: Commit**

```bash
git add components/GRWMVideoGenerator.tsx
git commit -m "refactor(grwm): remove auto-save after process"
```

---

## Task 7: Remove Auto-Save from ImageEditor

**Files:**
- Modify: `components/ImageEditor.tsx`

**Step 1: Remove addImage after edit operations (lines 124, 1221)**

**Step 2: Keep the explicit Save button save (line 1273) - this is intentional user action**

**Step 3: Commit**

```bash
git add components/ImageEditor.tsx
git commit -m "refactor(editor): remove auto-save, keep explicit save button"
```

---

## Task 8: Remove Auto-Save from Inpainting

**Files:**
- Modify: `components/Inpainting.tsx`

**Step 1: Remove addImage after inpaint (line 347)**

**Step 2: Remove addImage on upload (line 371)**

**Step 3: Commit**

```bash
git add components/Inpainting.tsx
git commit -m "refactor(inpainting): remove auto-save"
```

---

## Task 9: Remove Auto-Save from LookbookGenerator + Add Save All

**Files:**
- Modify: `components/LookbookGenerator.tsx`

**Step 1: Remove addImage after generate (lines 482, 575)**

**Step 2: Remove addImage on upload (lines 113, 662)**

**Step 3: Add "Save All" button in results section**

Find the results grid section and add a Save All button above it:

```tsx
const { addImage, images } = useImageGallery();
const { showToast } = useToast();
const { t } = useLanguage();

const handleSaveAll = () => {
    let savedCount = 0;
    generatedImages.forEach(img => {
        const alreadySaved = images.some(i => i.base64 === img.base64);
        if (!alreadySaved) {
            addImage(img);
            savedCount++;
        }
    });
    if (savedCount > 0) {
        showToast(t('toast.imagesSaved', { count: savedCount }));
    }
};

// In JSX, before the images grid:
{generatedImages.length > 1 && (
    <button
        onClick={handleSaveAll}
        className="mb-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors flex items-center gap-2"
    >
        <GalleryIcon className="w-4 h-4" />
        {t('imageActions.saveAllToGallery')}
    </button>
)}
```

**Step 4: Commit**

```bash
git add components/LookbookGenerator.tsx
git commit -m "refactor(lookbook): remove auto-save, add Save All button"
```

---

## Task 10: Remove Auto-Save from PhotoAlbumCreator

**Files:**
- Modify: `components/PhotoAlbumCreator.tsx`

**Step 1: Remove addImage after create (line 152)**

**Step 2: Remove addImage on upload (lines 202, 205, 206)**

**Step 3: Commit**

```bash
git add components/PhotoAlbumCreator.tsx
git commit -m "refactor(photo-album): remove auto-save"
```

---

## Task 11: Remove Auto-Save from OutfitAnalysis

**Files:**
- Modify: `components/OutfitAnalysis.tsx`

**Step 1: Remove addImage after extract (line 226)**

**Step 2: Remove addImage on upload (line 88)**

**Step 3: Commit**

```bash
git add components/OutfitAnalysis.tsx
git commit -m "refactor(outfit-analysis): remove auto-save"
```

---

## Task 12: Remove Auto-Save from PoseChanger

**Files:**
- Modify: `components/PoseChanger.tsx`

**Step 1: Remove addImage after pose change (lines 155, 206, 233)**

**Step 2: Remove addImage on upload (lines 244, 283)**

**Step 3: Commit**

```bash
git add components/PoseChanger.tsx
git commit -m "refactor(pose): remove auto-save"
```

---

## Task 13: Remove Auto-Save from SwapFace

**Files:**
- Modify: `components/SwapFace.tsx`

**Step 1: Remove addImage after face swap (line 96)**

**Step 2: Remove addImage on upload (lines 116, 122)**

**Step 3: Commit**

```bash
git add components/SwapFace.tsx
git commit -m "refactor(swap-face): remove auto-save"
```

---

## Task 14: Remove Auto-Save from Relight

**Files:**
- Modify: `components/Relight.tsx`

**Step 1: Remove addImage after relight (line 186)**

**Step 2: Remove addImage on upload (line 212)**

**Step 3: Commit**

```bash
git add components/Relight.tsx
git commit -m "refactor(relight): remove auto-save"
```

---

## Task 15: Remove Auto-Save from Upscale

**Files:**
- Modify: `components/Upscale.tsx`

**Step 1: Remove addImage after upscale (line 66)**

**Step 2: Remove addImage on upload (line 88)**

**Step 3: Commit**

```bash
git add components/Upscale.tsx
git commit -m "refactor(upscale): remove auto-save"
```

---

## Task 16: Remove Auto-Save from VideoGenerator

**Files:**
- Modify: `components/VideoGenerator.tsx`

**Step 1: Remove addImage on upload face image (line 245)**

**Step 2: Commit**

```bash
git add components/VideoGenerator.tsx
git commit -m "refactor(video): remove auto-save on upload"
```

---

## Task 17: Remove Auto-Save from Hooks

**Files:**
- Modify: `hooks/useLookbookGenerator.ts`
- Modify: `hooks/useVirtualTryOn.ts`

**Step 1: useLookbookGenerator - remove addImage (line 207)**

**Step 2: useVirtualTryOn - remove addImage after generate and on upload (lines 92, 102)**

**Step 3: Commit**

```bash
git add hooks/useLookbookGenerator.ts hooks/useVirtualTryOn.ts
git commit -m "refactor(hooks): remove auto-save from lookbook and try-on hooks"
```

---

## Task 18: Manual Testing Checklist

Run dev server and verify:

```bash
npm run dev
```

**Test cases:**
- [ ] Generate image in VirtualTryOn - should NOT auto-save
- [ ] Click Save to Gallery icon - should save and show toast
- [ ] Icon changes to green "Saved" state after save
- [ ] Already saved image shows disabled green icon
- [ ] LookbookGenerator "Save All" button works
- [ ] Upload image - should NOT auto-save to gallery
- [ ] ImageEditor explicit Save button still works
- [ ] Gallery still accessible and functional
- [ ] Toast notification appears and auto-dismisses

---

## Task 19: Final Commit

```bash
git add -A
git commit -m "feat(gallery): complete manual save implementation"
```

---

## Summary

| Phase | Tasks | Est. Changes |
|-------|-------|--------------|
| Setup | Tasks 1-3 | 4 files |
| Core Feature | Task 3 | HoverableImage |
| Remove Auto-Save | Tasks 4-17 | 14 components + 2 hooks |
| Testing | Task 18 | Manual QA |

**Total:** ~19 tasks, ~20 files modified
