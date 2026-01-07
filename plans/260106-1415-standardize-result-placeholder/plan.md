# Plan: Standardize Result Placeholder

**Created:** 2026-01-06
**Status:** Ready for Implementation
**Context:** [Brainstorm Report](../reports/brainstorm-260106-1415-standardize-result-placeholder.md)

## Overview

Tạo shared `ResultPlaceholder` component và refactor tất cả features để đồng nhất UI.

## Pattern Chuẩn (from VirtualTryOn)

```tsx
<div className="absolute inset-0 flex items-center justify-center p-4">
  <div className="text-center text-zinc-500 pointer-events-none">
    <GalleryIcon className="mx-auto h-16 w-16" />
    <h3 className="mt-4 text-base md:text-lg font-semibold text-zinc-400">
      {t('common.outputPanelTitle')}
    </h3>
    <p className="mt-1 text-sm">
      {t('[feature].outputPanelDescription')}
    </p>
  </div>
</div>
```

## Phases

### Phase 1: Create Shared Component
**File:** `components/shared/ResultPlaceholder.tsx`

```tsx
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { GalleryIcon } from '../Icons';

interface ResultPlaceholderProps {
  /** Feature-specific description from i18n */
  description: string;
  /** Override default title if needed */
  title?: string;
  /** Additional container classes */
  className?: string;
}

/**
 * Standardized result placeholder for all features.
 * Shows icon, title, and description when no result is available.
 */
const ResultPlaceholder: React.FC<ResultPlaceholderProps> = ({
  description,
  title,
  className = ''
}) => {
  const { t } = useLanguage();

  return (
    <div className={`absolute inset-0 flex items-center justify-center p-4 ${className}`}>
      <div className="text-center text-zinc-500 pointer-events-none">
        <GalleryIcon className="mx-auto h-16 w-16" />
        <h3 className="mt-4 text-base md:text-lg font-semibold text-zinc-400">
          {title || t('common.outputPanelTitle')}
        </h3>
        <p className="mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
};

export default ResultPlaceholder;
```

### Phase 2: Add Missing Translation Keys

**Files:** `locales/en.ts`, `locales/vi.ts`

| Feature | Key | EN | VI |
|---------|-----|----|----|
| BackgroundReplacer | `background.outputPanelDescription` | "Your background-replaced image will appear here." | "Ảnh đã thay nền sẽ xuất hiện ở đây." |
| PoseChanger | `pose.outputPanelDescription` | "Your pose-changed image will appear here." | "Ảnh đã đổi dáng sẽ xuất hiện ở đây." |
| Relight | `relight.outputPanelDescription` | "Your relit image will appear here." | "Ảnh đã chỉnh sáng sẽ xuất hiện ở đây." |
| PhotoAlbumCreator | `photoAlbum.outputPanelDescription` | "Your photo album will appear here." | "Album ảnh của bạn sẽ xuất hiện ở đây." |
| AIEditor | `aiEditor.outputPanelDescription` | "Your AI-edited image will appear here." | "Ảnh đã chỉnh sửa AI sẽ xuất hiện ở đây." |
| GRWMVideoGenerator | `grwmVideo.outputPanelDescription` | "Your GRWM video will appear here." | "Video GRWM của bạn sẽ xuất hiện ở đây." |

### Phase 3: Refactor Features

| # | File | Current | Action |
|---|------|---------|--------|
| 1 | `VirtualTryOn.tsx:320-331` | Inline code | Replace with `<ResultPlaceholder description={t('virtualTryOn.outputPanelDescription')} />` |
| 2 | `BackgroundReplacer.tsx:373-379` | `flex-grow flex` wrapper | Replace, add new key |
| 3 | `PoseChanger.tsx:410-415` | `ImageIcon`, no wrapper | Replace, add new key |
| 4 | `Relight.tsx:273-277` | Missing description | Replace, add new key |
| 5 | `VideoGenerator.tsx:333-337` | `FilmIcon` | Replace |
| 6 | `LookbookOutput.tsx:124-130` | `p-8` padding | Replace |
| 7 | `PhotoAlbumCreator.tsx:298-301` | Missing desc, `py-16` | Replace, add new key |
| 8 | `Upscale.tsx:142` | `ImageIcon` | Replace |
| 9 | `AIEditor.tsx:257` | Missing structure | Add full component |
| 10 | `GRWMVideoGenerator.tsx` | Check needed | Replace if exists |
| 11 | `VideoContinuity.tsx` | Check needed | Replace if exists |

## Implementation Order

```
1. Create shared/ResultPlaceholder.tsx
2. Add translation keys to en.ts and vi.ts
3. Refactor critical: AIEditor (missing structure)
4. Refactor high: PhotoAlbumCreator, Relight (missing description)
5. Refactor remaining features
6. Build & test
```

## Validation Checklist

- [ ] `npm run build` passes
- [ ] All 10+ features use ResultPlaceholder
- [ ] All features have description text
- [ ] All features show GalleryIcon
- [ ] Visual consistency verified

## File Changes Summary

| Action | Count | Files |
|--------|-------|-------|
| Create | 1 | `components/shared/ResultPlaceholder.tsx` |
| Edit | 2 | `locales/en.ts`, `locales/vi.ts` |
| Refactor | 10-11 | Feature components |

## Risks

- **Low:** Pattern proven in VirtualTryOn
- **Medium:** Need verify each feature's parent container compatibility with `absolute inset-0`

## Notes

- Some features may need `className` override if parent container doesn't use `relative`
- Keep responsive: `text-base md:text-lg` for title
