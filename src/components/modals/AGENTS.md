<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# modals

## Purpose
Các dialog và overlay surfaces lazy-loaded từ `App.tsx`. Chúng nhận state/handlers từ app shell hoặc contexts để hiển thị gallery, prompt library, settings, và pose selection mà không thay đổi routing.

## Key Files
| File | Description |
|------|-------------|
| `GalleryModal.tsx` | Gallery browser với Drive sync indicators và mở editor từ ảnh đã lưu. |
| `PromptLibraryModal.tsx` | Quản lý prompt library và reused prompt selections. |
| `SettingsModal.tsx` | Studio settings, API keys, và model selection surfaces. |
| `PoseLibraryModal.tsx` | Chọn pose references cho pose-related workflows. |
| `ImageSelectionModal.tsx` | Cho phép chọn ảnh từ gallery để đẩy vào feature flow. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Modal props tối thiểu nên giữ `isOpen` và `onClose` rõ ràng.
- Modal là surface hiển thị/nhập liệu; tránh thêm orchestration logic nặng ở đây.
- `SettingsModal` hiện là known tech debt vì còn chạm service trực tiếp; đừng nhân rộng pattern đó sang file mới.
- Giữ lazy-loading compatibility với `App.tsx` khi đổi export shape.

### Testing Requirements
- Component-level assertions nằm trong `__tests__/components/`.
- Nếu modal phụ thuộc context, test cả render path lẫn callback path quan trọng.
- Kiểm tra manual open/close flow nếu sửa hành vi hiển thị hoặc keyboard interactions.

### Common Patterns
- Controlled modal pattern: parent/app shell sở hữu open state.
- Một số modals tiêu thụ context sâu hơn feature screens vì đây là surfaces chia sẻ toàn app.
- Modal files thường export default hoặc named export được `React.lazy` unwrap trong `App.tsx`.

## Dependencies

### Internal
- `../AGENTS.md` cho component-level conventions.
- `../../contexts/` cho gallery, language, API, và Drive state.

### External
- React lazy/suspense runtime.
- Tailwind classes cho overlay styling.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
