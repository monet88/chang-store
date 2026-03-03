# Notepad: Fix Pre-existing TypeScript Errors

## Inherited Wisdom

### Plan Summary
- **Total Errors:** ~20 TypeScript errors
- **Root Causes:** 3 issues
- **Phases:** 4 phases (1-3 parallel, 4 verification)

### Phase Breakdown
1. **Phase 1:** `import.meta.env` - Missing Vite client types in tsconfig.json
2. **Phase 2:** `useApi`/`getModelsForFeature` argument mismatch - Type says 0 args, runtime passes 1
3. **Phase 3:** `requireAivideoautoConfig` - Missing identifier in PhotoAlbumCreator.tsx
4. **Phase 4:** Verification - Ensure `tsc --noEmit` returns zero errors

### Conventions
- Follow existing code patterns
- Update both type definitions and implementations consistently
- Run `npx tsc --noEmit` after each fix
- Ensure `npm run build` still passes

### Files of Interest
- `tsconfig.json`
- `contexts/ApiProviderContext.tsx`
- `hooks/useApi.ts` (if exists)
- `components/PhotoAlbumCreator.tsx`
- 17 call sites using `useApi(Feature.X)` or `getModelsForFeature(Feature.X)`
## Mon Mar  2 13:42:17 SEAST 2026 Task: T-b3736d08-82db-4ba2-a2a8-3fdb2d065fbc
- Thêm 'vite/client' vào mảng types trong tsconfig.json giúp sửa lỗi 'import.meta.env' không tồn tại trên Type 'ImportMeta'.
- Cần giữ cả 'node' và 'vite/client' để đảm bảo hỗ trợ cả môi trường Node và Vite.

## Mon Mar  2 14:26:00 SEAST 2026 Task: T-bfeb9470-4bf7-45e5-8cb7-057271bd8726
- Với lỗi `Expected 0 arguments, but got 1` ở `getModelsForFeature`, sửa đúng phạm vi là cập nhật chữ ký type ở `ApiContextType` sang `(feature?: Feature) => ...`.
- Không cần đổi runtime behavior; chỉ cần cho implementation chấp nhận tham số tùy chọn (`_feature?: Feature`) để đồng bộ type với call sites hiện có.
- Khi `tsc` đang bật incremental + `assumeChangesOnlyAffectDirectDependencies`, có thể cần chạy một lượt `npx tsc --noEmit --assumeChangesOnlyAffectDirectDependencies false` để refresh diagnostics trước khi chạy lại `npx tsc --noEmit`.
## Mon Mar  2 13:46:01 SEAST 2026 Task: T-1ad62935-a1e7-4d3b-8320-e2f4fe3af0d0
- `requireAivideoautoConfig` trong `components/PhotoAlbumCreator.tsx` là dead code: chỉ có 1 lần tham chiếu và không có khai báo/import tương ứng trong toàn repo.
- Sửa bằng cách xóa guard `if (!requireAivideoautoConfig()) return;` để loại bỏ lỗi TypeScript "Cannot find name" mà không đổi luồng validate chính (ảnh nguồn, pose).
- Xác minh: `npx tsc --noEmit 2>&1 | grep "requireAivideoautoConfig"` không còn output; `npm run build` pass.
