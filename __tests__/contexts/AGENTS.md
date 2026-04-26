<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# contexts tests

## Purpose
Provider và context hook tests cho language, API/model preferences, image gallery, Google Drive auth state, và image viewer behavior. Các tests này đảm bảo global state không vỡ khi feature hooks/components tiêu thụ contexts.

## Key Files
| File | Description |
|------|-------------|
| `ApiProviderContext.test.tsx` | API key/model preference provider behavior. |
| `LanguageContext.test.tsx` | Translation lookup và language state behavior. |
| `ImageGalleryContext.test.tsx` | Gallery state, cache, và mutations. |
| `GoogleDriveContext.test.tsx` | Drive auth/session behavior. |
| `ImageViewerContext.test.tsx` | Viewer open/close/navigation state. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Test cả provider-wrapped usage lẫn guard error khi hook dùng ngoài provider nếu context có guard.
- Mock/sandbox localStorage để tránh state leak giữa tests.
- Suppress expected `console.error` trong guard-error tests và restore spy sau đó.

### Testing Requirements
- Chạy context test tương ứng khi sửa provider hoặc context contract.
- Nếu sửa persistence keys/default values, cập nhật tests cho load và save paths.

### Common Patterns
- Tạo wrapper component local cho `renderHook` hoặc `render`.
- localStorage mock dùng closure store và reset bằng `clear()`.
- Provider tests nên quan sát public context value, không private state.

## Dependencies

### Internal
- `../../src/contexts/` là code under test.
- `../../src/components/Toast.tsx` liên quan provider stack nhưng không nằm trong `contexts/`.

### External
- React Testing Library, Vitest, jsdom localStorage.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
