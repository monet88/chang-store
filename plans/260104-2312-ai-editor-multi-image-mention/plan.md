---
title: "AI Editor với Multi-Image Mention"
description: "Refactor Inpainting thành AI Editor với hệ thống mention ảnh @img1, @img2"
status: pending
priority: P2
effort: 4h
branch: main
tags: [frontend, refactor, feature]
created: 2026-01-04
---

# AI Editor với Multi-Image Mention System

## Overview

Chuyển đổi AI Inpainting → AI Editor với khả năng:
- Upload nhiều ảnh (không giới hạn)
- Mention ảnh trong prompt với `@img1`, `@img2`
- Autocomplete dropdown khi gõ `@`
- Bỏ mask tools (rectangle, brush, eraser)

**Brainstorm Report:** [brainstorm-260104-2312-ai-editor-multi-image-mention.md](../reports/brainstorm-260104-2312-ai-editor-multi-image-mention.md)

## Architecture

```
AIEditor.tsx
├── MultiImageUploader (với tag overlays @img1, @img2)
├── MentionTextarea (với autocomplete dropdown)
├── ImageOptionsPanel (reuse)
└── Result Display (HoverableImage)
```

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | MentionTextarea Component | Pending | 1.5h | [phase-01](./phase-01-mention-textarea.md) |
| 2 | MultiImageUploader Tag Overlay | Pending | 30m | [phase-02](./phase-02-multi-image-tag-overlay.md) |
| 3 | Refactor Inpainting → AIEditor | Pending | 1.5h | [phase-03](./phase-03-refactor-ai-editor.md) |
| 4 | Update Types & Translations | Pending | 30m | [phase-04](./phase-04-update-types-translations.md) |

## Dependencies

- Existing: `MultiImageUploader.tsx`, `ImageOptionsPanel.tsx`, `HoverableImage.tsx`
- API: `imageEditingService.ts` - no changes needed

## Success Criteria

- [ ] Upload N ảnh → hiển thị tag @img1 đến @imgN
- [ ] Gõ `@` → hiện dropdown với thumbnails
- [ ] Select mention → insert `@imgN`
- [ ] API nhận đúng images được mention
- [ ] 1 ảnh kết quả hiển thị
