<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# config tests

## Purpose
Tests cho model selection và config rules. Hiện thư mục này tập trung xác minh feature-to-model-scope behavior để UI selector và provider routing không lệch nhau.

## Key Files
| File | Description |
|------|-------------|
| `modelSelectionRules.test.ts` | Xác nhận `Feature` values resolve đúng `ModelSelectionScope` hoặc `null`. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Cập nhật tests khi thêm feature mới hoặc đổi selection scope của feature hiện có.
- Assert trên public exported functions thay vì internal maps nếu có thể.

### Testing Requirements
- Chạy `npm run test -- __tests__/config/modelSelectionRules.test.ts` sau khi sửa `src/config/modelSelectionRules.ts`.
- Chạy type-check nếu đổi `ModelSelectionType` hoặc registry contracts.

### Common Patterns
- Tests nên bao phủ cả feature có scope và feature không cần selector.
- Expected labels/options nên khớp registry source hiện tại.

## Dependencies

### Internal
- `../../src/config/` là code under test.
- `../../src/types.ts` cung cấp `Feature` enum.

### External
- Vitest.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
