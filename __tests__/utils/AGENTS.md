<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# utils tests

## Purpose
Tests cho pure utilities: image processing helpers, prompt builders, image cache, ZIP/download behavior, và small data transformation utilities. Đây là suite nhanh và nên có coverage tốt nhất vì ít phụ thuộc UI.

## Key Files
| File | Description |
|------|-------------|
| `imageUtils.test.ts` | Image dimensions/conversion/compression/error message helpers. |
| `imageCache.test.ts` | Cache behavior, metrics, và eviction semantics. |
| `virtual-try-on-prompt-builder.test.ts` | Try-on prompt construction behavior. |
| `lookbookPromptBuilder.test.ts` | Lookbook prompt builder branches. |
| `pattern-generator-prompt-builder.test.ts` | Pattern generator prompt helpers. |
| `zipDownload.test.ts` | ZIP export/download behavior. |
| `imageDownload.test.ts` | Single-image download helpers. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Vì utilities nên thuần, tests nên ít mock và tập trung input/output.
- Với prompt builders, assert presence/order/conditional sections thay vì snapshot toàn bộ string quá giòn.
- Với browser image/file APIs, dùng controlled mocks và restore sau test.

### Testing Requirements
- Chạy single utility test khi sửa helper tương ứng.
- Thêm regression tests trước hoặc cùng lúc sửa lỗi trong utility dùng rộng rãi.

### Common Patterns
- Dùng constants cho test images/base64 payloads.
- `global.Image`, `FileReader`, URL APIs có thể cần mock trong jsdom.
- Error formatting tests nên bao phủ cả `Error`, structured error keys, và unknown values.

## Dependencies

### Internal
- `../../src/utils/` là code under test.
- `../../src/types.ts` cung cấp shared fixtures/contracts.

### External
- Vitest và jsdom browser API shims.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
