<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# components tests

## Purpose
Component-level tests cho render output, accessibility-facing queries, và user interactions của UI layer. Các tests này nên giữ mỏng, vì business logic được kiểm thử ở hooks/services.

## Key Files
| File | Description |
|------|-------------|
| `VirtualTryOn.test.tsx` | Render/interaction coverage cho try-on component. |
| `ClothingTransfer.test.tsx` | Component coverage cho clothing transfer flow. |
| `Upscale.test.tsx` | Upscale component shell behavior. |
| `SettingsModal.test.tsx` | Settings modal rendering và interaction paths. |
| `Header.test.tsx` | Header/navigation bề mặt. |
| `UtilityDock.test.tsx` | Studio utility dock interactions. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Mock hooks/services dependencies; không test business logic qua component internals.
- Ưu tiên queries theo role/label trước `getByText`, và chỉ dùng `getByTestId` khi không còn lựa chọn tốt.
- Nếu component text dùng i18n, mock `t()` trả key và assert trên key.

### Testing Requirements
- Chạy `npm run test -- __tests__/components/<file>.test.tsx` khi sửa component tương ứng.
- Thêm tests cho disabled/loading/error/empty states nếu component expose các trạng thái đó.

### Common Patterns
- `vi.mock()` hook hoặc child component dependencies trước import component under test.
- `beforeEach` gọi `vi.clearAllMocks()`.
- Render tests tập trung vào user-observable behavior.

## Dependencies

### Internal
- `../../src/components/` là code under test.
- `../__mocks__/` cung cấp shared mocks khi cần context setup.

### External
- `@testing-library/react`, `@testing-library/user-event`, `vitest`.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
