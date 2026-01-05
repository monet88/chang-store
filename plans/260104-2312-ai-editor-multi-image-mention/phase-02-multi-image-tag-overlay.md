# Phase 02: MultiImageUploader Tag Overlay

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: None (can run parallel with Phase 01)

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 30m
- **Description:** Add @img1, @img2 tag overlays on image thumbnails

## Key Insights
- MultiImageUploader already has thumbnail grid (lines 201-231)
- Currently shows "Image 1", "Image 2" on hover
- Need to change to always-visible `@img1`, `@img2` tags

## Requirements

### Functional
- Display `@imgN` tag on each thumbnail (always visible, not hover-only)
- Tag style: amber text, semi-transparent dark background
- Position: top-left corner of thumbnail

### Non-Functional
- Keep existing functionality intact
- No performance impact

## Architecture

Current structure (line 225-227):
```tsx
<div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100">
  {t('common.image')} {index + 1}
</div>
```

New structure:
```tsx
{/* Tag overlay - always visible */}
<div className="absolute top-1 left-1 bg-black/70 text-amber-400 text-xs font-mono px-1.5 py-0.5 rounded">
  @img{index + 1}
</div>
```

## Related Code Files

### Files to Modify
| File | Changes |
|------|---------|
| `components/MultiImageUploader.tsx` | Add tag overlay, remove/modify hover label |

## Implementation Steps

### Step 1: Locate thumbnail render section
File: `components/MultiImageUploader.tsx`, lines 201-231

### Step 2: Replace hover label with always-visible tag
```typescript
// Before (lines 225-227)
<div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
  {t('common.image')} {index + 1}
</div>

// After
<div className="absolute top-1 left-1 bg-black/70 text-amber-400 text-xs font-mono px-1.5 py-0.5 rounded">
  @img{index + 1}
</div>
```

### Step 3: Keep delete button on hover (existing behavior - line 215-224)
No changes needed - delete button already works correctly.

## Todo List

- [ ] Edit `MultiImageUploader.tsx` line 225-227
- [ ] Replace hover label with always-visible tag
- [ ] Test with multiple images
- [ ] Verify tag visibility and styling

## Success Criteria

- [ ] Each thumbnail shows `@img1`, `@img2`, etc.
- [ ] Tags always visible (not hover-only)
- [ ] Amber text on dark background
- [ ] Delete button still works on hover

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Tag overlaps delete button | Different corners (tag: top-left, delete: top-right) |

## Security Considerations
- None

## Next Steps
- Phase 03: Refactor Inpainting → AIEditor
