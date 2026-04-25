<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# superpowers plans

## Purpose
Implementation plans sinh từ superpowers/agent workflows. Các file này ghi lại goal, file scope, review status, và task checklist cho một thay đổi cụ thể.

## Key Files
| File | Description |
|------|-------------|
| `2026-03-24-tryon-prompt-optimization.md` | Plan tối ưu Virtual Try-On prompt builder sang interleaved `Part[]` workflow. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Đọc plan như context lịch sử; kiểm tra lại code thật trước khi tiếp tục implementation.
- Nếu plan yêu cầu sửa file, vẫn tuân thủ CLAUDE.md và GitNexus/verification rules hiện hành.
- Không đánh dấu plan là hoàn tất nếu chưa kiểm tra trạng thái code và tests.

### Testing Requirements
- Không có tests cho plan docs; tests nằm ở code paths mà plan nhắc tới.
- Khi implement theo plan, chạy checks được plan yêu cầu và checks của repo.

### Common Patterns
- Plans dùng checkbox tasks và bảng File Structure.
- Nội dung thường chứa review status từ CEO/Eng review hoặc agent workflow.

## Dependencies

### Internal
- `../../../src/` và `../../../__tests__/` là implementation/test targets thường được plan nhắc tới.

### External
- Không có runtime dependency.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
