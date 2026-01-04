# Phase 01c: Lazy Component Key Props

**Agent Type:** fullstack-developer
**Priority:** P1 Medium
**Estimated Time:** 30min
**Issue Reference:** ISSUE 5 from performance report

---

## Objective

Add key props to all 14 lazy-loaded feature components to ensure React properly reconciles components when switching features.

**Performance Impact:**
- Ensures component state properly resets on feature switch
- Prevents React reconciliation bugs (wrong component state preserved)
- Improves developer debugging experience

---

## Current Problem

```typescript
// App.tsx:96-129
const renderActiveFeature = () => {
  switch (activeFeature) {
    case Feature.TryOn:
      return <VirtualTryOn />; // ❌ No key prop
    case Feature.Lookbook:
      return <LookbookGenerator />; // ❌ No key prop
    // ... 12 more cases without keys
  }
};
```

**Issue:** React may incorrectly reuse component instances when switching features, leading to:
- Stale state from previous feature
- Unexpected behavior
- Difficult-to-debug issues

**Solution:** Add unique key prop based on Feature enum value

---

## Implementation

### Update renderActiveFeature Function

```typescript
// App.tsx:96-129
const renderActiveFeature = () => {
  switch (activeFeature) {
    case Feature.TryOn:
      return <VirtualTryOn key="try-on" />;
    case Feature.Lookbook:
      return <LookbookGenerator key="lookbook" />;
    case Feature.Background:
      return <BackgroundReplacer key="background" />;
    case Feature.Pose:
      return <PoseChanger key="pose" onOpenPoseLibrary={handleOpenPoseLibrary} />;
    case Feature.SwapFace:
      return <SwapFace key="swap-face" />;
    case Feature.PhotoAlbum:
      return <PhotoAlbumCreator key="photo-album" />;
    case Feature.OutfitAnalysis:
      return <OutfitAnalysis key="outfit-analysis" />;
    case Feature.Relight:
      return <Relight key="relight" />;
    case Feature.Upscale:
      return <Upscale key="upscale" />;
    case Feature.Video:
      return <VideoGenerator key="video" />;
    case Feature.VideoContinuity:
      return <VideoContinuity key="video-continuity" />;
    case Feature.GRWMVideo:
      return <GRWMVideoGenerator key="grwm-video" />;
    case Feature.Inpainting:
      return <Inpainting key="inpainting" />;
    case Feature.ImageEditor:
      return null; // Rendered separately as modal, no key needed
    default:
      return <VirtualTryOn key="try-on" />;
  }
};
```

---

## Key Naming Convention

**Pattern:** Use Feature enum string value directly (kebab-case)

**Rationale:**
- Consistent with Feature enum values
- Easy to trace in React DevTools
- Self-documenting

**Verify Feature Enum Values:**
```typescript
// types.ts - should contain something like:
export enum Feature {
  TryOn = 'try-on',
  Lookbook = 'lookbook',
  Background = 'background',
  Pose = 'pose',
  SwapFace = 'swap-face',
  PhotoAlbum = 'photo-album',
  OutfitAnalysis = 'outfit-analysis',
  Relight = 'relight',
  Upscale = 'upscale',
  Video = 'video',
  VideoContinuity = 'video-continuity',
  GRWMVideo = 'grwm-video',
  Inpainting = 'inpainting',
  ImageEditor = 'image-editor',
}
```

**If enum values differ:** Use actual enum values for keys

---

## Files to Modify

**Primary File:**
- `App.tsx` (lines 96-129)

**Reference File (to verify enum values):**
- `types.ts` (Feature enum definition)

---

## Implementation Checklist

- [ ] Read Feature enum from types.ts
- [ ] Verify correct string values for each feature
- [ ] Add key prop to VirtualTryOn
- [ ] Add key prop to LookbookGenerator
- [ ] Add key prop to BackgroundReplacer
- [ ] Add key prop to PoseChanger (preserve onOpenPoseLibrary prop)
- [ ] Add key prop to SwapFace
- [ ] Add key prop to PhotoAlbumCreator
- [ ] Add key prop to OutfitAnalysis
- [ ] Add key prop to Relight
- [ ] Add key prop to Upscale
- [ ] Add key prop to VideoGenerator
- [ ] Add key prop to VideoContinuity
- [ ] Add key prop to GRWMVideoGenerator
- [ ] Add key prop to Inpainting
- [ ] Add key prop to default case (VirtualTryOn)
- [ ] Verify ImageEditor case returns null (modal, no key needed)
- [ ] Check for console warnings about keys

---

## Testing Requirements

### Manual Testing - Feature Switching
1. **Test Feature Rotation:**
   - Start at TryOn
   - Upload image, fill form
   - Switch to Lookbook
   - Verify TryOn state cleared (form empty)
   - Upload image in Lookbook
   - Switch back to TryOn
   - Verify Lookbook state cleared

2. **Test All 14 Features:**
   - Click through all features in Header
   - Verify each feature loads correctly
   - Verify no stale state from previous feature

3. **Test Edge Cases:**
   - Rapid feature switching (click 5 features quickly)
   - Switch while image is uploading
   - Switch while generation is in progress

### Console Verification
- [ ] Open DevTools Console
- [ ] Switch features 5+ times
- [ ] Verify NO warnings about missing keys
- [ ] Verify NO warnings about key conflicts

### React DevTools Verification
1. Open React DevTools Components tab
2. Switch features
3. Observe component tree:
   - Each feature component should unmount/remount cleanly
   - No orphaned components in tree
   - Key props visible in component inspector

---

## Acceptance Criteria

✅ **All 14 feature components have key props**
✅ **Keys match Feature enum string values**
✅ **PoseChanger retains onOpenPoseLibrary prop**
✅ **ImageEditor case returns null (unchanged)**
✅ **Default case has key prop**
✅ **No console warnings about keys**
✅ **Feature switching works correctly**
✅ **Component state properly resets on switch**
✅ **No reconciliation bugs observed**

---

## Expected Behavior Changes

**Before (without keys):**
- React may reuse component instances
- Unpredictable state preservation
- Difficult to debug

**After (with keys):**
- React guaranteed to unmount/remount on feature switch
- Component state always fresh
- Predictable, clean state management

---

## Performance Impact

**Minimal overhead:**
- Key comparison: ~0.1ms per render
- Component unmount/mount: ~5-10ms (necessary for clean state)

**Overall:** Slight performance cost, but necessary for correctness

---

## Potential Issues & Solutions

### Issue 1: Feature State Loss
**Problem:** User switches features accidentally, loses work

**Solution (Future Enhancement):**
```typescript
// Add confirmation dialog for unsaved work
const handleSetActiveFeature = useCallback((feature: Feature) => {
  if (hasUnsavedWork) {
    if (confirm('You have unsaved work. Switch feature?')) {
      setActiveFeature(feature);
    }
  } else {
    setActiveFeature(feature);
  }
}, [hasUnsavedWork]);
```

**Note:** NOT in scope for this phase, just document for future

### Issue 2: Lazy Loading Delay
**Problem:** Unmount/remount causes lazy chunk re-fetch

**Solution:** Already optimized - Vite caches lazy chunks

---

## Rollback Plan

If issues arise:
```bash
git checkout App.tsx
```

**Risk Level:** Very low - adding keys is non-breaking change

---

## Additional Notes

**Why not use index as key?**
- Feature order is fixed
- Enum value is more semantic
- Better debugging in React DevTools

**Why ImageEditor doesn't need key?**
- Rendered separately as modal (lines 175-180)
- Controlled by activeFeature === Feature.ImageEditor condition
- Already properly isolated from other features

---

**Status:** Ready for implementation
**Agent:** fullstack-developer-1c
