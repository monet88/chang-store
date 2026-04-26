<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# shared

## Purpose
Các UI building blocks được tái sử dụng giữa nhiều features trong `src/components/`. Đây là những thành phần trình bày nhỏ, không nên chứa orchestration logic hoặc knowledge đặc thù của một service.

## Key Files
| File | Description |
|------|-------------|
| `ImageBatchSessionRail.tsx` | Rail hiển thị trạng thái/lịch sử cho các batch image workflows. |
| `RefinementInput.tsx` | Bề mặt nhập refinement prompt dùng lại ở nhiều feature; hiện là known tech-debt hotspot. |
| `ResultPlaceholder.tsx` | Placeholder/skeleton hiển thị khi chưa có output. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Giữ components đủ generic để tái sử dụng; nếu logic bắt đầu đặc thù cho một feature, cân nhắc di chuyển về feature đó.
- Tránh gọi services trực tiếp từ shared components mới.
- `RefinementInput.tsx` đang nằm trong danh sách known direct-service imports; không sao chép pattern này sang file khác.

### Testing Requirements
- Nếu thêm behavior mới, viết component tests tập trung vào rendering và callbacks.
- Kiểm tra các shared components trong ít nhất một feature consumer để tránh regression styling/props.

### Common Patterns
- Shared components nhận props thuần và để feature parent quyết định state/handlers.
- Chúng thường được dùng bởi các workflows dạng batch, refinement, hoặc result review.

## Dependencies

### Internal
- `../AGENTS.md` cho conventions chung của tầng component.
- Nhiều feature screens trong cùng thư mục là consumer của các component này.

### External
- React component props patterns.
- Tailwind utility classes.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
