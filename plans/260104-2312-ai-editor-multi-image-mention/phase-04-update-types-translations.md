# Phase 04: Update Types & Translations

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: Phase 03 (AIEditor component)

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 30m
- **Description:** Update Feature enum, App.tsx imports, and i18n translations

## Key Insights
- Feature enum: `Inpainting` → `AIEditor`
- App.tsx: Update import and component usage
- Translations: Add aiEditor keys, can keep/remove inpainting keys

## Requirements

### Functional
- Feature.AIEditor works in app routing
- All UI text translated (EN, VI)
- No TypeScript errors

### Non-Functional
- Keep translation key structure consistent

## Related Code Files

### Files to Modify
| File | Changes |
|------|---------|
| `types.ts` | Update Feature enum |
| `App.tsx` | Update import, component render |
| `locales/en.ts` | Add aiEditor translations |
| `locales/vi.ts` | Add aiEditor translations |
| `components/Tabs.tsx` | Update tab label if needed |

## Implementation Steps

### Step 1: Update Feature enum in types.ts
```typescript
// Before (line 14)
Inpainting = 'inpainting',

// After
AIEditor = 'ai-editor',
```

### Step 2: Update App.tsx

**Import (around line 20):**
```typescript
// Before
import Inpainting from './components/Inpainting';

// After
import AIEditor from './components/AIEditor';
```

**Component render (find Inpainting usage):**
```tsx
// Before
<div style={{ display: activeFeature === Feature.Inpainting ? 'block' : 'none' }}>
  <Inpainting />
</div>

// After
<div style={{ display: activeFeature === Feature.AIEditor ? 'block' : 'none' }}>
  <AIEditor />
</div>
```

### Step 3: Update Tabs.tsx (if has hardcoded labels)
Check if tabs have hardcoded feature labels or use translations.

### Step 4: Add English translations (locales/en.ts)
```typescript
aiEditor: {
  title: 'AI Editor',
  description: 'Edit images using AI with multi-image references. Use @img1, @img2 to reference uploaded images.',
  uploadTitle: 'Upload Images',
  promptLabel: 'Editing Prompt',
  promptPlaceholder: 'Describe your edit. Use @img1, @img2 to reference images. Example: "Change the outfit color in @img1 to match @img2"',
  generateButton: 'Generate',
  generatingStatus: 'Generating edited image...',
  error: {
    noImages: 'Please upload at least one image.',
    noPrompt: 'Please enter an editing prompt.',
  },
},
```

### Step 5: Add Vietnamese translations (locales/vi.ts)
```typescript
aiEditor: {
  title: 'AI Editor',
  description: 'Chỉnh sửa ảnh bằng AI với tham chiếu nhiều ảnh. Dùng @img1, @img2 để tham chiếu ảnh đã tải.',
  uploadTitle: 'Tải ảnh lên',
  promptLabel: 'Mô tả chỉnh sửa',
  promptPlaceholder: 'Mô tả chỉnh sửa. Dùng @img1, @img2 để tham chiếu ảnh. Ví dụ: "Đổi màu outfit ở @img1 giống với @img2"',
  generateButton: 'Tạo ảnh',
  generatingStatus: 'Đang tạo ảnh...',
  error: {
    noImages: 'Vui lòng tải lên ít nhất một ảnh.',
    noPrompt: 'Vui lòng nhập mô tả chỉnh sửa.',
  },
},
```

### Step 6: Update ApiProviderContext if needed
Check if `getModelsForFeature` has Inpainting hardcoded.

### Step 7: Remove old inpainting translations (optional)
Can keep for reference or remove to clean up.

## Todo List

- [ ] Update `Feature` enum in `types.ts`
- [ ] Update `App.tsx` import and render
- [ ] Check `Tabs.tsx` for hardcoded labels
- [ ] Add `aiEditor` translations to `en.ts`
- [ ] Add `aiEditor` translations to `vi.ts`
- [ ] Check `ApiProviderContext` for feature references
- [ ] Run TypeScript check (`npm run build`)
- [ ] Test feature switching in app

## Success Criteria

- [ ] No TypeScript errors
- [ ] Feature.AIEditor routes correctly
- [ ] Tab shows "AI Editor" label
- [ ] All UI text displays correctly (EN, VI)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking other features | Only change Inpainting references |
| Missing translations | Check all t() calls in AIEditor |

## Security Considerations
- None

## Next Steps
- Testing and QA
