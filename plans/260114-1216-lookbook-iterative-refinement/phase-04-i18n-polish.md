# Phase 4: i18n & Polish

## Context Links
- [English locale](../../locales/en.ts)
- [Vietnamese locale](../../locales/vi.ts)
- [Phase 3: UI Components](./phase-03-ui-components.md)

## Overview
- **Priority**: P2
- **Status**: Pending
- **Effort**: 0.5h

Add translations and polish UX.

## Requirements

### Functional
- All new strings in both locales
- Tooltip for refinement feature
- Loading message during refinement

### Non-Functional
- Consistent translation style
- Natural Vietnamese translations

## Related Code Files

### Modify
| File | Description |
|------|-------------|
| `locales/en.ts` | Add English strings |
| `locales/vi.ts` | Add Vietnamese strings |

## Implementation Steps

### Step 1: Add English translations

```typescript
// In locales/en.ts, add to lookbook section:

lookbook: {
  // ... existing keys ...
  
  // Refinement feature
  refinementHistory: 'Refinement History',
  refinementPlaceholder: 'Describe changes (e.g., "make background darker")...',
  refineButton: 'Refine',
  resetRefinement: 'Reset to original',
  refineError: 'Cannot refine without a generated image',
  refiningStatus: 'Refining image...',
},

// Add to common section:
common: {
  // ... existing keys ...
  justNow: 'just now',
  minutesAgo: '{{count}}m ago',
  hoursAgo: '{{count}}h ago',
},

// Add to tooltips section:
tooltips: {
  // ... existing keys ...
  lookbookRefinement: 'Describe changes to refine the generated image. The AI remembers previous refinements.',
},
```

### Step 2: Add Vietnamese translations

```typescript
// In locales/vi.ts, add to lookbook section:

lookbook: {
  // ... existing keys ...
  
  // Refinement feature
  refinementHistory: 'Lịch sử chỉnh sửa',
  refinementPlaceholder: 'Mô tả thay đổi (vd: "làm nền tối hơn")...',
  refineButton: 'Chỉnh sửa',
  resetRefinement: 'Đặt lại về ảnh gốc',
  refineError: 'Không thể chỉnh sửa khi chưa có ảnh',
  refiningStatus: 'Đang chỉnh sửa ảnh...',
},

// Add to common section:
common: {
  // ... existing keys ...
  justNow: 'vừa xong',
  minutesAgo: '{{count}} phút trước',
  hoursAgo: '{{count}} giờ trước',
},

// Add to tooltips section:
tooltips: {
  // ... existing keys ...
  lookbookRefinement: 'Mô tả các thay đổi để chỉnh sửa ảnh. AI sẽ nhớ các chỉnh sửa trước đó.',
},
```

### Step 3: Add tooltip to RefinementInput

Wrap input label with Tooltip component for feature explanation.

## Todo List

- [ ] Add English translations to `en.ts`
- [ ] Add Vietnamese translations to `vi.ts`
- [ ] Add tooltip to refinement input
- [ ] Test both languages
- [ ] Verify loading message displays

## Success Criteria

- [ ] All strings display correctly in English
- [ ] All strings display correctly in Vietnamese
- [ ] Tooltip explains feature
- [ ] Time ago format works (1m ago, 2h ago)
- [ ] No hardcoded strings in components

## Final Verification Checklist

After all phases complete:

- [ ] Generate lookbook image
- [ ] Type refinement prompt
- [ ] Press Enter or click Refine
- [ ] See loading state
- [ ] See refined image
- [ ] See history item
- [ ] Expand history
- [ ] Click reset
- [ ] Verify image returns to original (new generation needed)
- [ ] Test in Vietnamese
- [ ] Test error states

## Next Steps

Feature complete! Create issue in beads for tracking:

```bash
bd create "Lookbook AI - Iterative refinement with Gemini chat context" \
  -t feature \
  -p 1 \
  --description "Add prompt input below result image for iterative refinement" \
  --json
```
