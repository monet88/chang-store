<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# config

## Purpose
Model capability registry và rules ánh xạ feature sang model-selection scopes. Đây là lớp quyết định model nào xuất hiện trong UI và capability nào được bật khi gọi generation/editing APIs.

## Key Files
| File | Description |
|------|-------------|
| `modelRegistry.ts` | Registry cho image edit, image generate, và text generate models; capability lookup và default models. |
| `modelSelectionRules.ts` | Ánh xạ `Feature` sang `ModelSelectionType` để app shell và selector biết scope đang active. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Khi thêm model mới, cập nhật registry và cân nhắc capabilities (`supportsImageSize`, `supportsAspectRatio`).
- Khi thêm feature mới, cập nhật `FEATURE_SELECTION_SCOPE` trong `modelSelectionRules.ts` nếu feature cần model selector.
- Giữ provider/model IDs chính xác; nếu không chắc API/model name, tra vendor docs trước.

### Testing Requirements
- Cập nhật `__tests__/config/modelSelectionRules.test.ts` khi đổi feature-to-scope behavior.
- Chạy `npx tsc --noEmit` sau khi đổi registry contracts hoặc model selection types.

### Common Patterns
- `ModelSelectionType` gom model theo ba scope chính: `imageEdit`, `imageGenerate`, `textGenerate`.
- `DEFAULT_MODEL_BY_SELECTION_TYPE` quyết định default UI/provider behavior.
- Capabilities được dùng để tránh gửi options không được model hỗ trợ.

## Dependencies

### Internal
- `../types.ts` cung cấp `Feature` enum.
- `../services/gemini/image.ts` dùng capability lookup khi build request config.
- `../components/GlobalModelSelector.tsx` và `../App.tsx` tiêu thụ selection scopes.

### External
- Google/Gemini model IDs và capability behavior từ vendor APIs.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
