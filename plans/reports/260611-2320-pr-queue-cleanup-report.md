# Báo cáo dọn hàng chờ PR

- Thời gian: 2026-06-11 23:20 ICT
- Mục tiêu:
  - đóng các PR đã bị supersede sau đợt merge trước
  - tách nội dung còn giá trị của PR `#38` thành một PR mới dựa trên `main`

## Kết quả

- Đã dựng lại nội dung `#38` trên branch mới từ `main`
- Phạm vi PR mới chỉ gồm 5 thay đổi nhỏ:
  - `src/components/ImageUploader.tsx`
  - `src/components/MultiImageUploader.tsx`
  - `src/components/VirtualTryOn.tsx`
  - `src/services/googleDriveService.ts`
  - `src/utils/imageUtils.ts`
- Mẫu thay đổi thống nhất:
  - thay `split(',')[1]`
  - bằng `substring(indexOf(',') + 1)`

## Verify cục bộ

- `npx tsc --noEmit` pass
- `node node_modules/eslint/bin/eslint.js src/utils/imageUtils.ts src/components/ImageUploader.tsx src/components/MultiImageUploader.tsx src/components/VirtualTryOn.tsx src/services/googleDriveService.ts` pass
- `git diff --check` pass

## Quyết định hàng chờ

- Đóng `#42`, `#44`, `#46` vì đã bị supersede bởi các PR mới hơn đã merge
- Đóng `#38` cũ sau khi mở PR mới thay thế trên `main`
- Giữ nguyên `#28` và `#29` vì không thuộc nhóm superseded nhỏ, cần review riêng
