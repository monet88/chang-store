<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# gemini

## Purpose
Provider-specific implementation layer cho Gemini/Google AI flows. Facades ở `src/services/` gọi vào đây để thực hiện image editing/generation, text generation, chat, và video-related logic.

## Key Files
| File | Description |
|------|-------------|
| `image.ts` | Gemini image edit/generate request assembly, response parsing, capability-aware config, và safety/no-content handling. |
| `text.ts` | Gemini text generation workflows cho analysis, critique, và prompt generation. |
| `video.ts` | Video generation/polling logic và prompt-heavy video workflows. |
| `chat.ts` | Chat-style Gemini interaction helpers. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Đây là provider-specific code; giữ API quirks ở đây thay vì đẩy lên hooks/components.
- Khi thay đổi request shape, kiểm tra model capability constraints từ `src/config/modelRegistry.ts`.
- Xử lý safety blocks, empty candidates, text-only responses, và finish reasons rõ ràng; đừng swallow lỗi.
- Không hardcode API keys; lấy client qua service/client abstraction hiện có.

### Testing Requirements
- Provider behavior được kiểm thử trong `__tests__/services/gemini/`.
- Khi đổi response parsing, thêm tests cho success, safety block, no candidates, no content, và text-only paths nếu liên quan.
- Nếu dùng `@google/genai` API mới, xác minh docs hiện hành trước khi implement.

### Common Patterns
- `image.ts` build `Part[]` content từ images/prompt hoặc nhận `interleavedParts` prebuilt.
- `getModelCapabilities()` quyết định có gửi `aspectRatio`/`imageSize` hay không.
- Errors dùng i18n-friendly keys như `error.api.safetyBlock`.

## Dependencies

### Internal
- `../apiClient.ts` cung cấp Gemini client.
- `../../config/modelRegistry.ts` cung cấp capability lookup.
- `../../types.ts` cung cấp shared image/model contracts.

### External
- `@google/genai` SDK.
- Google/Gemini model APIs và response schema.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
