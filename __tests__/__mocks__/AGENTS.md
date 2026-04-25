<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# __mocks__

## Purpose
Reusable test mocks cho external modules và app contexts. Thư mục này giúp test suites giữ setup nhất quán khi mock Gemini SDK, Axios, và context hooks.

## Key Files
| File | Description |
|------|-------------|
| `axios.ts` | Manual Axios mock dùng trong service/network tests. |
| `contexts.tsx` | Mock factory helpers cho `useLanguage`, `useApi`, gallery, và viewer contexts. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `@google/` | Manual mock cho `@google/genai` SDK (xem `@google/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Giữ mocks generic và composable; test-specific overrides nên truyền qua partial overrides, không hardcode vào mock base.
- Khi context contract thay đổi, cập nhật mock factory tương ứng cùng lúc để tránh false positives/negatives.
- Không để mock state leak giữa tests; factories nên tạo defaults sạch.

### Testing Requirements
- Chạy suites phụ thuộc mock khi sửa mock shape.
- Type-check giúp bắt contract mismatch với `src/contexts/` nếu mocks được typed đủ rõ.

### Common Patterns
- `mockUseLanguage()` trả `t` function default là identity key.
- `mockUseApi()` cung cấp model defaults và setters dạng `vi.fn()`.
- Module-level mocks nằm đúng path mà source imports sử dụng.

## Dependencies

### Internal
- `../../src/contexts/` và `../../src/types.ts` cho contract alignment.
- Các test suites trong `../components/`, `../hooks/`, và `../services/` tiêu thụ mocks này.

### External
- Vitest `vi.fn()` và module mock system.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
