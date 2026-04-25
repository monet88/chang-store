<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# @google mocks

## Purpose
Manual module mocks cho Google SDK imports trong test environment. Hiện thư mục này mock `@google/genai` để tests không gọi API thật.

## Key Files
| File | Description |
|------|-------------|
| `genai.ts` | Mock surface cho `@google/genai`, bao gồm constructor/API shapes cần bởi service tests. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Cập nhật mock khi production code dùng thêm class, enum, hoặc method từ `@google/genai`.
- Giữ mock tối thiểu nhưng đủ shape để tests phản ánh hành vi service thực tế.
- Không nhúng API credentials hoặc network calls vào mocks.

### Testing Requirements
- Chạy Gemini service tests sau khi sửa mock này.
- Nếu mock shape đổi, kiểm tra các test failures để phân biệt mismatch mock và bug production.

### Common Patterns
- Manual mock path phải khớp module name mà Vitest resolves.
- Export shape nên mirror những gì production imports thật sự dùng.

## Dependencies

### Internal
- `../AGENTS.md` cho conventions mock chung.
- `../../services/gemini/` tests tiêu thụ mock này.

### External
- Vitest manual mock resolution.
- `@google/genai` public import surface.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
