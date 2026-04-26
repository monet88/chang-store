<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# upscale

## Purpose
Tập hợp sub-components cho feature Upscale, chia workflow thành các bước phân tích, chỉnh prompt, enhance, preview, và output review. Logic trung tâm vẫn nằm trong `src/hooks/useUpscale.ts`, còn các file ở đây thiên về step UI và composition.

## Key Files
| File | Description |
|------|-------------|
| `UpscaleStudioStepShell.tsx` | Layout shell và progress framing cho studio flow. |
| `UpscaleAnalyzeStep.tsx` | Bước phân tích chất lượng ảnh đầu vào. |
| `UpscaleAnalysisReportCard.tsx` | Hiển thị kết quả phân tích và guidance. |
| `UpscaleEnhanceStep.tsx` | Bước chạy upscale với prompt package. |
| `UpscaleQuickPanel.tsx` | One-shot quick mode UI. |
| `UpscaleOutputPanel.tsx` | Xem và tải output sau khi enhance. |
| `UpscalePromptPackage.tsx` | Preview/chỉnh prompt package trước khi upscale. |
| `UpscaleSessionImageRail.tsx` | Lịch sử ảnh trong phiên upscale. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Không thêm service calls trực tiếp vào đây; tất cả state/handlers phải đi qua `useUpscale.ts` và `Upscale.tsx`.
- Chỉ giữ local state cho concerns thuần UI như hover hoặc disclosure nhỏ.
- Nếu thêm step mới, cập nhật parent orchestrator và đảm bảo naming mô tả đúng phase.
- Giữ distinction rõ giữa Studio mode và Quick mode trong component boundaries.

### Testing Requirements
- Bề mặt render và user interaction nhẹ nên nằm trong `__tests__/components/`.
- Logic phân nhánh sâu của workflow nên được test ở `useUpscale` hook thay vì ở từng child component.
- Với thay đổi UI lớn, kiểm tra manual flow qua cả Studio và Quick modes.

### Common Patterns
- Parent component truyền xuống slices của hook state thay vì để children tự fetch dữ liệu.
- Step-based composition giúp giữ `Upscale.tsx` dễ điều phối hơn dù workflow nhiều pha.
- Các card/panel ở đây thiên về hiển thị trạng thái hơn là quyết định nghiệp vụ.

## Dependencies

### Internal
- `../Upscale.tsx` là parent feature screen.
- `../../hooks/useUpscale.ts` là nguồn logic chính.

### External
- React component composition.
- Tailwind-based UI styling.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
