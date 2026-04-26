<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# types

## Purpose
Ambient TypeScript declarations nằm ngoài `src/`, chủ yếu để bổ sung typings cho browser globals hoặc vendor APIs mà project dùng trực tiếp ở runtime web.

## Key Files
| File | Description |
|------|-------------|
| `google.d.ts` | Khai báo kiểu cho Google Identity Services OAuth2 namespace dùng trong browser auth flows. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Chỉ thêm hoặc sửa khai báo khi runtime API thực sự tồn tại và được app sử dụng.
- Giữ declaration bám sát shape của vendor/browser API; không biến file này thành nơi chứa application types.
- Nếu cần shared app contracts, ưu tiên `src/types.ts` thay vì thêm vào đây.

### Testing Requirements
- Sau khi sửa typings, chạy `npx tsc --noEmit` để xác nhận compiler hiểu đúng ambient declarations.

### Common Patterns
- Dùng `declare namespace` cho browser globals như `google.accounts.oauth2`.
- File ở đây bổ sung môi trường compile-time, không tạo runtime code.

## Dependencies

### Internal
- `../src/contexts/GoogleDriveContext.tsx` và các browser integrations là nơi tiêu thụ chính các declarations này.

### External
- Google Identity Services JavaScript API.
- TypeScript ambient declaration system.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
