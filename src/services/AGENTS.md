<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# services

## Purpose
Stateless service facade layer của ứng dụng. Thư mục này gom các API-facing modules và routing logic, giữ network/provider interactions tách khỏi components và hooks.

## Key Files
| File | Description |
|------|-------------|
| `imageEditingService.ts` | Unified facade cho edit/generate flows, routing request vào Gemini image operations. |
| `textService.ts` | Text generation facade cho critique, analysis, và prompt-based text workflows. |
| `upscaleAnalysisService.ts` | Chạy quality analysis và chuẩn bị prompt package cho upscale workflow. |
| `apiClient.ts` | Gemini SDK client access và API key–aware client setup. |
| `googleDriveService.ts` | Google Drive upload/list/delete helpers cho gallery sync. |
| `debugService.ts` | Debug logging helpers cho service-layer instrumentation. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `gemini/` | Provider-specific Gemini implementations cho image, text, video, và chat workflows (xem `gemini/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Giữ services stateless; đừng đưa UI state hoặc React concerns vào đây.
- Không bypass `imageEditingService.ts` khi thêm/sửa image workflows mới nếu chúng thuộc tuyến facade chính.
- Provider-specific logic nên nằm trong `gemini/`; facade files chỉ nên route, normalize, và chuẩn bị parameters.
- Tránh hardcode secrets hoặc cấu hình người dùng; mọi key phải đi từ provider/context layer.

### Testing Requirements
- Routing logic và error propagation nên được bao phủ trong `__tests__/services/`.
- Khi thêm branch routing mới, cập nhật service tests để xác nhận parameter forwarding đúng.
- Nếu sửa Gemini response handling, kiểm tra cả no-content/safety/text-only branches.

### Common Patterns
- Facade ở đây gọi xuống `gemini/*` thay vì để hooks gọi provider modules trực tiếp.
- Status updates thường được chuyển qua callback trong config object.
- Service functions trả về shared `ImageFile`-shaped payloads dùng xuyên app.

## Dependencies

### Internal
- `../hooks/` là nơi gọi vào services.
- `gemini/` chứa provider-specific implementation details.
- `../config/` được dùng cho model capabilities và selection behavior.

### External
- `@google/genai` qua client/provider modules.
- Browser `fetch`/OAuth-related APIs cho Google Drive integration.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
