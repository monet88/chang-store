# Brainstorm Report: AI Editor với Multi-Image Mention System

**Date:** 2026-01-04
**Feature:** Chuyển đổi AI Inpainting → AI Editor với hệ thống mention ảnh

---

## 1. Problem Statement

### Current State
- **Inpainting component** chỉ hỗ trợ 1 ảnh gốc + mask tools
- Không thể reference nhiều ảnh trong prompt
- Mask tools (rectangle, brush, eraser) phức tạp

### Desired State
- **AI Editor** hỗ trợ upload nhiều ảnh (không giới hạn)
- Tag system: `@img1`, `@img2`, ... tự động đánh số
- Mention trong prompt với autocomplete dropdown
- Output: 1 ảnh kết quả
- Bỏ mask tools

### Example Use Case
```
Upload: [ảnh outfit đỏ] [ảnh outfit xanh]
Tags:   @img1            @img2

Prompt: "Đổi màu outfit ở @img1 thành màu giống @img2"
```

---

## 2. Evaluated Approaches

### Approach A: Simple Manual Tags
**Description:** User tự gõ @img1, @img2 theo thứ tự upload

| Pros | Cons |
|------|------|
| Đơn giản implement | UX kém, dễ nhầm số |
| Không cần UI phức tạp | Không validation |

**Verdict:** ❌ Rejected - UX kém

### Approach B: Autocomplete Dropdown (Recommended)
**Description:** Khi gõ `@`, hiện dropdown chọn ảnh với preview thumbnail

| Pros | Cons |
|------|------|
| UX tốt, như Discord/Slack mention | Cần custom textarea |
| Visual confirmation via thumbnail | Phức tạp hơn một chút |
| Prevent typos | |

**Verdict:** ✅ Selected

### Approach C: Rich Text Editor
**Description:** Dùng rich text editor như Slate.js với embedded image chips

| Pros | Cons |
|------|------|
| Rất professional | Over-engineering |
| Inline image preview | Dependency lớn |

**Verdict:** ❌ Rejected - Over-engineering cho use case này

---

## 3. Recommended Solution

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Editor Component                    │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐   │
│ │        MultiImageUploader (existing component)        │   │
│ │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │   │
│ │  │@img1 │ │@img2 │ │@img3 │ │ +Add │                  │   │
│ │  └──────┘ └──────┘ └──────┘ └──────┘                  │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │              MentionTextarea (new component)          │   │
│ │  ┌─────────────────────────────────────────────────┐  │   │
│ │  │ Edit màu outfit @|                              │  │   │
│ │  └─────────────────┬───────────────────────────────┘  │   │
│ │                    │                                  │   │
│ │              ┌─────┴─────┐                            │   │
│ │              │ @img1 [👗]│  ← Dropdown with thumbnail │   │
│ │              │ @img2 [👔]│                            │   │
│ │              └───────────┘                            │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │               ImageOptionsPanel (reuse)               │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. AI Editor (refactored from Inpainting)
- **Remove:** All mask-related code (canvas, brush, eraser, rectangle)
- **Keep:** ImageOptionsPanel, result display, error handling
- **Add:** MultiImageUploader integration, MentionTextarea

#### 2. MultiImageUploader (modify existing)
- Add: Tag display overlay (`@img1`, `@img2`, ...) on each image thumbnail
- Keep: All existing functionality (drag/drop, remove, compression)

#### 3. MentionTextarea (new component)
```typescript
interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  images: ImageFile[];  // For generating mention options
  placeholder?: string;
}
```

**Features:**
- Detect `@` character while typing
- Show dropdown với thumbnail + tag options
- Insert `@imgN` on selection
- Highlight mentions trong textarea (optional)

### Prompt Engineering

Khi submit, transform prompt:
```typescript
// User prompt
"Đổi màu outfit ở @img1 thành màu giống @img2"

// Transformed for API
`# INSTRUCTION: MULTI-IMAGE EDITING

## IMAGE ROLES:
- Image 1 (@img1): Reference image 1
- Image 2 (@img2): Reference image 2
[... dynamically generated based on mentions ...]

## USER REQUEST:
"Đổi màu outfit ở @img1 thành màu giống @img2"

## OUTPUT:
Return the edited version of @img1 as the final result.
`
```

---

## 4. Implementation Considerations

### State Management
```typescript
interface AIEditorState {
  images: ImageFile[];           // All uploaded images
  prompt: string;                // With @mentions
  isLoading: boolean;
  error: string | null;
  resultImage: ImageFile | null;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
}
```

### Mention Detection Logic
```typescript
const MENTION_REGEX = /@img(\d+)/g;

function extractMentionedImages(prompt: string, images: ImageFile[]): ImageFile[] {
  const mentions = prompt.matchAll(MENTION_REGEX);
  const indices = [...mentions].map(m => parseInt(m[1]) - 1);
  return indices.filter(i => i >= 0 && i < images.length).map(i => images[i]);
}
```

### Files to Modify/Create

| File | Action |
|------|--------|
| `components/Inpainting.tsx` | Refactor → `AIEditor.tsx` |
| `components/MultiImageUploader.tsx` | Add tag overlay display |
| `components/MentionTextarea.tsx` | **New** - Autocomplete textarea |
| `App.tsx` | Update import/component name |
| `types.ts` | Update Feature enum |
| `locales/en.ts` | Update translations |
| `locales/vi.ts` | Update translations |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Autocomplete dropdown positioning | Use `useRef` + `getBoundingClientRect` for proper positioning |
| Large image array perf | Limit to reasonable number (10-20) if issues arise |
| Prompt injection | Sanitize mentions before API call |

---

## 5. Success Metrics

- [ ] Upload N ảnh, hiển thị tag overlay `@img1` đến `@imgN`
- [ ] Gõ `@` hiện dropdown với thumbnail preview
- [ ] Select mention → insert `@imgN` vào prompt
- [ ] API nhận đúng images được mention
- [ ] Result image hiển thị đúng

---

## 6. Next Steps

1. **Create implementation plan** với chi tiết từng step
2. **Implement MentionTextarea** component first (can test independently)
3. **Refactor Inpainting → AIEditor**
4. **Update translations** và Feature enum
5. **Test end-to-end** với real API calls

---

## Decision

✅ **Approved approach:** Autocomplete Dropdown với MentionTextarea component

**Key benefits:**
- Clean UX với visual confirmation
- Reuse existing MultiImageUploader
- Simple state management
- No external dependencies

**Trade-offs accepted:**
- Custom textarea implementation (moderate complexity)
- Limited rich text features (acceptable for this use case)
