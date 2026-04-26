<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# utils

## Purpose
Pure helpers và data-transformation utilities cho prompt building, image processing, caching, bounded concurrency, storage, và download/export. Đây là tầng không phụ thuộc React contexts hoặc UI state.

## Key Files
| File | Description |
|------|-------------|
| `imageUtils.ts` | Image helpers, compression, dimensions, và error formatting. |
| `lookbookPromptBuilder.ts` | Prompt builder cho nhiều lookbook presentation modes. |
| `virtual-try-on-prompt-builder.ts` | Prompt/parts builder cho virtual try-on flow. |
| `clothing-transfer-prompt-builder.ts` | Prompt builder cho clothing transfer workflow. |
| `run-bounded-workers.ts` | Worker-pool helper cho batch concurrency giới hạn. |
| `imageCache.ts` | In-memory image cache utilities. |
| `zipDownload.ts` | Export nhiều ảnh thành ZIP cho download flows. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Giữ functions thuần và tách khỏi React/hooks/contexts.
- Nếu utility bắt đầu chứa nhiều orchestration hoặc service awareness, cân nhắc chuyển nó sang hook/service phù hợp.
- `getErrorMessage` nên tiếp tục là điểm chuẩn hóa lỗi thay vì nhân bản parsing logic ở nhiều nơi.
- Prompt builders nên nhận input tường minh và trả về string/parts không phụ thuộc side effects.

### Testing Requirements
- Mọi helper thuần mới nên có test trong `__tests__/utils/`.
- Với prompt builders, test cả branches theo mode/input khác nhau thay vì chỉ snapshot một output duy nhất.
- Sau thay đổi utility dùng rộng rãi, chạy test suites liên quan để phát hiện regression lan truyền.

### Common Patterns
- Utilities ở đây thường được import từ hooks/services, không theo chiều ngược lại.
- Prompt builders encode domain rules cho fashion/image workflows nhưng vẫn giữ output thuần.
- Concurrency helpers được dùng để tránh request storms trong batch features.

## Dependencies

### Internal
- `../hooks/` và `../services/` là consumer chính.
- `../types.ts` cung cấp shared contracts cho nhiều helper.

### External
- `jszip` cho ZIP export.
- Browser image/file APIs cho image processing helpers.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
