<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# contexts

## Purpose
Global React providers cho language, API/model preferences, Google Drive auth, image gallery state, và image viewer state. Đây là lớp persistence/shared state giữa nhiều features.

## Key Files
| File | Description |
|------|-------------|
| `LanguageContext.tsx` | i18n state và `t('key.path')` lookup. |
| `ApiProviderContext.tsx` | API key access và model selection persistence. |
| `GoogleDriveContext.tsx` | OAuth/session state cho Google Drive sync. |
| `ImageGalleryContext.tsx` | In-memory gallery state và sync coordination. |
| `ImageViewerContext.tsx` | Shared viewer modal state và navigation. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Tôn trọng provider stack order trong `src/App.tsx`; thay đổi thứ tự có thể phá dependency chain.
- Không chuyển `ToastProvider` vào đây; nó sống ở `src/components/Toast.tsx` theo thiết kế hiện tại.
- Persistence logic và side effects nên ở provider, không ở consuming component.
- Không lưu binary image data vào localStorage; gallery images giữ in-memory.

### Testing Requirements
- Provider behavior và guard errors nằm trong `__tests__/contexts/`.
- Khi sửa persistence/session behavior, test cả load-from-storage lẫn update path.
- Chạy `npx tsc --noEmit` nếu đổi shared context contracts.

### Common Patterns
- Mỗi file thường export provider + hook tiêu thụ tương ứng (`useApi`, `useLanguage`, ...).
- localStorage sync nằm bên trong provider cho settings và preferences.
- Contexts là điểm kết nối giữa feature hooks và app-wide shared state.

## Dependencies

### Internal
- `../hooks/` và `../components/` tiêu thụ context hooks.
- `../services/` được dùng từ bên trong provider cho sync/integration flows.

### External
- React context API.
- Browser localStorage và Google browser APIs khi cần persistence/auth.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
