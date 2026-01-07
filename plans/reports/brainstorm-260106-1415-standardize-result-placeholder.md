# Brainstorm Report: Standardize Result Placeholder

**Date:** 2026-01-06
**Status:** Agreed - Ready for Implementation

## Problem Statement

Các feature hiển thị placeholder result không đồng nhất:
- Icon khác nhau (GalleryIcon vs ImageIcon vs FilmIcon)
- Một số thiếu description
- Container structure khác nhau
- Translation keys không thống nhất

**Độ nhất quán hiện tại:** ~60%

## Current State Analysis

| Feature | Icon | Description | Container | Status |
|---------|------|-------------|-----------|--------|
| VirtualTryOn | GalleryIcon | ✅ | `absolute inset-0` | ✅ Chuẩn |
| BackgroundReplacer | GalleryIcon | ✅ | `flex-grow flex` | ⚠️ |
| PoseChanger | ImageIcon | ✅ | Thiếu wrapper | ⚠️ |
| Relight | GalleryIcon | ❌ | `p-4` inner | ⚠️ |
| VideoGenerator | FilmIcon | ✅ | `p-4` inner | ⚠️ |
| LookbookOutput | GalleryIcon | ✅ | `p-8` | ⚠️ |
| PhotoAlbumCreator | GalleryIcon | ❌ | `py-16` | ❌ |
| Upscale | ImageIcon | ✅ | Thiếu wrapper | ⚠️ |
| AIEditor | ? | ❌ | ❌ Thiếu | ❌ Critical |

## Agreed Solution

### User Decisions
1. **Icon:** GalleryIcon cho tất cả features
2. **Translation:** Feature-specific keys
3. **Architecture:** Tạo shared component

### Component Design

```tsx
// components/shared/ResultPlaceholder.tsx
interface ResultPlaceholderProps {
  title?: string;        // default: t('common.outputPanelTitle')
  description: string;   // required: feature-specific
  className?: string;    // container override
}
```

### Implementation Priority

| Priority | Action | Files |
|----------|--------|-------|
| 1 | Create shared component | `shared/ResultPlaceholder.tsx` |
| 2 | Fix AIEditor | Critical - thiếu structure |
| 3 | Fix PhotoAlbumCreator | Missing description |
| 4 | Fix Relight | Missing description |
| 5 | Refactor remaining | 6 files |

## Risks & Considerations

- **Low risk:** Pattern đã proven trong VirtualTryOn
- **Testing:** Cần verify từng feature sau refactor
- **i18n:** Ensure translation keys exist cho all features

## Success Metrics

- [ ] 100% features dùng shared component
- [ ] 100% có description text
- [ ] 100% dùng GalleryIcon
- [ ] Build passes
- [ ] Visual consistency across all features

## Next Steps

Tạo implementation plan chi tiết với `/plan` command.
