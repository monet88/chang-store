<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# gemini service tests

## Purpose
Provider-specific tests cho Gemini image và text modules. Các tests này xác minh request assembly, SDK response parsing, safety/error handling, và text/image output extraction.

## Key Files
| File | Description |
|------|-------------|
| `image.test.ts` | Tests cho Gemini image generation/editing behavior và error branches. |
| `text.test.ts` | Tests cho Gemini text generation workflows và response handling. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Mock `@google/genai` hoặc client layer thay vì gọi API thật.
- Khi sửa provider response parsing, thêm regression tests cho response shape mới.
- Giữ assertions tập trung vào public service behavior, không vào implementation details không quan trọng.

### Testing Requirements
- Chạy `npm run test -- __tests__/services/gemini/<file>.test.ts` sau khi sửa provider module tương ứng.
- Test safety/no-candidate/no-content/text-only branches khi chạm `src/services/gemini/image.ts`.

### Common Patterns
- Mock SDK response candidates/parts để mô phỏng Gemini outputs.
- Assert i18n-friendly error keys được throw đúng.
- Các tests cần tương thích với capability-aware request config từ model registry.

## Dependencies

### Internal
- `../../../src/services/gemini/` là code under test.
- `../../__mocks__/@google/` mock Google GenAI SDK.

### External
- Vitest và `@google/genai` mock surface.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
