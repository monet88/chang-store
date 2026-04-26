<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# api

## Purpose
Vendor/API reference documents dùng để đối chiếu model behavior, endpoint semantics, và provider capabilities khi làm việc với AI integrations. Đây là tài liệu tham khảo, không phải runtime code.

## Key Files
| File | Description |
|------|-------------|
| `gemini-3.md` | Reference notes cho Gemini 3 behavior/capabilities. |
| `imagen.md` | Imagen API/model reference. |
| `nano-banana.md` | Tài liệu dài cho Nano Banana / Gemini image-related behavior. |
| `gpt-image-2-official-spec.md` | Official spec snapshot cho GPT Image 2. |
| `kie-api-docs-link.md` | KIE API documentation reference. |
| `kling-2.6-motion-control.md` | Kling 2.6 motion control reference. |
| `kling-3.0-motion-control.md` | Kling 3.0 motion control reference. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Dùng docs ở đây để xác minh model/API behavior trước khi sửa provider integrations.
- Nếu tài liệu có thể đã cũ, ưu tiên vendor docs hiện hành trước khi thay đổi code production.
- Đừng copy nguyên blocks lớn vào code; tóm lược thành constants/config rõ ràng khi cần.

### Testing Requirements
- Không có test runner riêng cho API docs.
- Khi docs dẫn tới code change, test ở `__tests__/services/` hoặc layer liên quan.

### Common Patterns
- Files có thể lớn và vendor-specific; đọc đúng file theo provider/model cần thay đổi.
- API docs bổ trợ cho `src/services/` và `src/config/`.

## Dependencies

### Internal
- `../../src/services/` là consumer chính của kiến thức provider.
- `../../src/config/` dùng model/capability facts từ tài liệu liên quan.

### External
- Google Gemini/Imagen, OpenAI image, KIE, Kling, và các vendor docs liên quan.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
