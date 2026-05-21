# Phase 4: i18n Strings

## Context

- Plan: `plans/20260521-1203-wardrobe-mode-virtual-tryon/plan.md`
- Files: `src/locales/en.ts`, `src/locales/vi.ts`
- Can run parallel with Phase 2-3

## Overview

- Priority: Medium
- Status: pending
- Add all wardrobe mode translation keys

## Requirements

Add keys under `virtualTryOn` namespace for wardrobe mode UI elements.

## Implementation Steps

1. Add to `src/locales/en.ts` under `virtualTryOn`:
   ```
   modeMultiModel: 'Multi-Model'
   modeWardrobe: 'Wardrobe'
   wardrobeSubjectLabel: 'Model Photo'
   wardrobeSetLabel: 'Set {{number}}'
   addSet: 'Add Set'
   removeSet: 'Remove Set'
   maxSetsReached: 'Maximum 4 sets'
   generateAllSets: 'Generate All Sets'
   wardrobeResultsTitle: 'Wardrobe Results'
   wardrobeProgress: '{{completed}}/{{total}} sets completed'
   emptySetWarning: 'Add at least one item to each set'
   wardrobeExtraPrompt: 'Extra prompt (wardrobe)'
   wardrobeBackgroundPrompt: 'Background (wardrobe)'
   generatingBlocked: 'Generation in progress'
   ```
2. Add matching keys to `src/locales/vi.ts`:
   ```
   modeMultiModel: 'Nhiều Người Mẫu'
   modeWardrobe: 'Tủ Đồ'
   wardrobeSubjectLabel: 'Ảnh Người Mẫu'
   wardrobeSetLabel: 'Bộ {{number}}'
   addSet: 'Thêm Bộ'
   removeSet: 'Xóa Bộ'
   maxSetsReached: 'Tối đa 4 bộ'
   generateAllSets: 'Tạo Tất Cả'
   wardrobeResultsTitle: 'Kết Quả Tủ Đồ'
   wardrobeProgress: '{{completed}}/{{total}} bộ hoàn thành'
   emptySetWarning: 'Thêm ít nhất một item vào mỗi bộ'
   wardrobeExtraPrompt: 'Mô tả thêm (tủ đồ)'
   wardrobeBackgroundPrompt: 'Phông nền (tủ đồ)'
   generatingBlocked: 'Đang tạo ảnh'
   ```

## Todo

- [ ] Add English keys
- [ ] Add Vietnamese keys
- [ ] Verify no duplicate keys
- [ ] Verify `npx tsc --noEmit` passes

## Success Criteria

- All wardrobe UI text uses i18n keys (no hardcoded strings)
- Both en.ts and vi.ts have matching key sets

## Risk Assessment

- Low risk — additive only, no modifications to existing keys
