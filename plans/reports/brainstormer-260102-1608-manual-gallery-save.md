# Brainstorm: Manual Gallery Save Mechanism

**Date:** 2026-01-02
**Status:** Research Complete
**Author:** Brainstormer Agent

---

## 1. Problem Statement

**Current Behavior:**
- Mỗi khi một ảnh được generate (try-on, upscale, background replace, etc.), nó tự động được lưu vào Gallery thông qua `addImage()`.
- User không có quyền kiểm soát ảnh nào được lưu.
- Gallery có giới hạn 20 ảnh, nên các ảnh cũ bị đẩy ra khi ảnh mới được thêm vào.

**Desired Behavior:**
- Bỏ cơ chế auto-save vào gallery.
- Thêm icon "Save to Gallery" trên mỗi tấm ảnh được tạo.
- Chỉ khi user click vào icon đó thì mới lưu vào gallery.

---

## 2. Current Architecture Analysis

### 2.1 ImageGalleryContext
```
F:\CodeBase\Chang-Store\contexts\ImageGalleryContext.tsx
```
- Provides: `images[]`, `addImage()`, `deleteImage()`, `clearImages()`
- `GALLERY_SIZE_LIMIT = 20`
- Duplicate detection: `if (prevImages.some(img => img.base64 === image.base64))`

### 2.2 HoverableImage Component
```
F:\CodeBase\Chang-Store\components\HoverableImage.tsx
```
**Current hover action buttons:**
| Position | Actions |
|----------|---------|
| Top-right | Edit, Delete, Fullscreen |
| Bottom-center | Regenerate, Upscale, Download |

**Missing:** Save to Gallery icon

### 2.3 addImage() Call Sites (Components)

#### A. AUTO-SAVE AFTER GENERATE (Target for removal - 14 locations)

| File | Line | Context |
|------|------|---------|
| `VirtualTryOn.tsx` | 165 | After upscale result |
| `BackgroundReplacer.tsx` | 218 | After background replace |
| `GRWMVideoGenerator.tsx` | 57 | After crop/compress |
| `ImageEditor.tsx` | 124, 1221 | After edit operations |
| `Inpainting.tsx` | 347 | After inpaint |
| `LookbookGenerator.tsx` | 482, 575 | After lookbook generate |
| `PhotoAlbumCreator.tsx` | 152 | After album create |
| `OutfitAnalysis.tsx` | 226 | After extract image |
| `PoseChanger.tsx` | 155, 206, 233 | After pose change |
| `SwapFace.tsx` | 96 | After face swap |
| `Relight.tsx` | 186 | After relight |
| `Upscale.tsx` | 66 | After upscale |

#### B. AUTO-SAVE ON UPLOAD (Needs discussion - 15 locations)

| File | Lines | Context |
|------|-------|---------|
| `BackgroundReplacer.tsx` | 72, 78 | Upload input images |
| `Inpainting.tsx` | 371 | Upload input |
| `LookbookGenerator.tsx` | 113, 662 | Upload model/texture |
| `PhotoAlbumCreator.tsx` | 202, 205, 206 | Upload photos |
| `OutfitAnalysis.tsx` | 88 | Upload outfit |
| `PoseChanger.tsx` | 244, 283 | Upload subject |
| `SwapFace.tsx` | 116, 122 | Upload style/face |
| `Relight.tsx` | 212 | Upload image |
| `VirtualTryOn.tsx` | 175, 199 | Upload subject/clothing |
| `Upscale.tsx` | 88 | Upload image |
| `VideoGenerator.tsx` | 245 | Upload face image |

#### C. HOOKS (2 locations)

| File | Line | Context |
|------|------|---------|
| `useLookbookGenerator.ts` | 207 | After generate |
| `useVirtualTryOn.ts` | 92, 102 | After generate, on upload |

#### D. MANUAL SAVE (Keep as-is - 1 location)

| File | Line | Context |
|------|------|---------|
| `ImageEditor.tsx` | 1273 | Explicit "Save" button in modal |

---

## 3. Solution Options

### Option A: Add `onSaveToGallery` prop to HoverableImage (RECOMMENDED)

**Implementation:**
```typescript
// HoverableImage.tsx - add new prop
interface HoverableImageProps {
  // ... existing props
  onSaveToGallery?: () => void;
  isSavedToGallery?: boolean; // visual feedback
}
```

**Pros:**
- Follows existing pattern (like `onRegenerate`, `onUpscale`)
- Parent controls save logic
- Flexible - parent can customize behavior
- Easy to track "already saved" state per-image

**Cons:**
- Need to update all 13 components using HoverableImage
- Need to pass callback from each feature component

### Option B: HoverableImage imports useImageGallery directly

**Implementation:**
```typescript
// HoverableImage.tsx
const { addImage, images } = useImageGallery();
const isSaved = images.some(img => img.base64 === image.base64);
```

**Pros:**
- Zero changes to parent components
- Simpler implementation
- Automatic "already saved" detection

**Cons:**
- Higher coupling (component depends on context)
- Less flexible
- Violates single responsibility principle

### Option C: Create SaveableHoverableImage wrapper

**Implementation:**
```typescript
// SaveableHoverableImage.tsx
const SaveableHoverableImage: React.FC<Props> = (props) => {
  const { addImage, images } = useImageGallery();
  return <HoverableImage {...props} onSaveToGallery={() => addImage(props.image)} />;
};
```

**Pros:**
- Minimal change to existing HoverableImage
- Gradual migration possible
- Clear separation of concerns

**Cons:**
- Another component to maintain
- Need to update imports in 13 files anyway

---

## 4. Recommended Approach: Option A + B Hybrid

Combine the best of both:

1. **Add optional `onSaveToGallery` prop to HoverableImage**
2. **If not provided, HoverableImage falls back to using context directly**
3. **Always show save button (detect "already saved" via context)**

```typescript
// HoverableImage.tsx
const { addImage, images } = useImageGallery();
const isSavedToGallery = images.some(img => img.base64 === image.base64);

const handleSaveToGallery = () => {
  if (onSaveToGallery) {
    onSaveToGallery();
  } else {
    addImage(image);
  }
};
```

**Benefits:**
- Zero changes to parent components initially
- Flexibility for custom behavior later
- Automatic duplicate detection
- Visual feedback for "already saved"

---

## 5. UI/UX Considerations

### 5.1 Icon Placement

**Recommendation:** Add to top-right group (next to Edit, Delete, Fullscreen)

```
┌─────────────────────────────────────┐
│                           [S][E][X] │  <- S=Save, E=Edit, X=Close
│                                     │
│              IMAGE                  │
│                                     │
│         [Regen] [Up] [Down]         │  <- Bottom action bar
└─────────────────────────────────────┘
```

### 5.2 Visual States

| State | Icon Style | Tooltip |
|-------|------------|---------|
| Not saved | Outlined GalleryIcon, normal color | "Save to Gallery" |
| Saved | Filled GalleryIcon, amber/gold color | "Saved to Gallery" |
| Saving | Spinner | "Saving..." |

### 5.3 Feedback

- **Toast notification** khi save thành công: "Image saved to gallery"
- **Disable button** sau khi đã save (hoặc show checkmark)
- **Animate** icon khi hover (scale up slightly)

### 5.4 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Gallery full (20 images) | Show warning: "Gallery full. Oldest image will be removed." |
| Duplicate detected | Button disabled, show "Already in gallery" |
| Network error | N/A (images stored in-memory only) |
| User deletes from gallery, then re-saves | Allow re-save (duplicate check uses current state) |

---

## 6. Question: Should uploaded images still auto-save?

**Arguments FOR keeping auto-save on upload:**
- User explicitly chose this image, likely wants to keep it
- Convenient for re-using across features
- Current UX expectation

**Arguments AGAINST:**
- Inconsistent with new "manual save only" principle
- Gallery fills up with input images, not results
- User may upload many test images

**Recommendation:** REMOVE auto-save on upload too
- Consistent behavior: Gallery = curated collection
- User can still save input images manually if needed
- Reduces gallery clutter

---

## 7. Implementation Checklist

### Phase 1: Core Changes
- [ ] Add `onSaveToGallery` prop to `HoverableImage`
- [ ] Add fallback to context-based save
- [ ] Add "saved" state detection
- [ ] Add GalleryIcon button with states
- [ ] Add i18n keys for tooltips/toasts

### Phase 2: Remove Auto-Save (Generated Images)
- [ ] `VirtualTryOn.tsx` - line 165
- [ ] `BackgroundReplacer.tsx` - line 218
- [ ] `GRWMVideoGenerator.tsx` - line 57
- [ ] `ImageEditor.tsx` - lines 124, 1221
- [ ] `Inpainting.tsx` - line 347
- [ ] `LookbookGenerator.tsx` - lines 482, 575
- [ ] `PhotoAlbumCreator.tsx` - line 152
- [ ] `OutfitAnalysis.tsx` - line 226
- [ ] `PoseChanger.tsx` - lines 155, 206, 233
- [ ] `SwapFace.tsx` - line 96
- [ ] `Relight.tsx` - line 186
- [ ] `Upscale.tsx` - line 66
- [ ] `useLookbookGenerator.ts` - line 207
- [ ] `useVirtualTryOn.ts` - line 92

### Phase 3: Remove Auto-Save (Uploaded Images) - Optional
- [ ] All `onImageUpload` callbacks that include `addImage()`

### Phase 4: Testing
- [ ] Verify save button appears on all generated images
- [ ] Verify "saved" state persists and displays correctly
- [ ] Verify duplicate detection works
- [ ] Verify ImageEditor manual save still works
- [ ] Verify "Select from Gallery" in ImageUploader still works

---

## 8. Unresolved Questions

1. **Toast notifications:** Add react-hot-toast or similar library? Or use custom toast?

2. **Animation:** Should saved icon animate (pulse, bounce)?

3. **Batch save:** LookbookGenerator can generate multiple images. Add "Save All" button?

4. **Upload images:** Final decision - remove auto-save on upload or keep?

5. **Gallery full warning:** Show before save (requires checking count) or after (simpler)?

---

## 9. Next Steps

1. User confirms approach (Option A+B hybrid)
2. User decides on upload auto-save removal
3. Create implementation plan with detailed tasks
4. Begin Phase 1 implementation

---

*Report generated by Brainstormer Agent*
