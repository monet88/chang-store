<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# docs

## Purpose
Tài liệu checked-in cho kiến trúc, vendor references, và planning artifacts hỗ trợ việc phát triển Chang-Store. Thư mục này bổ sung cho mã nguồn bằng các tài liệu định hướng, nhưng phải luôn khớp với trạng thái repo hiện tại.

## Key Files
| File | Description |
|------|-------------|
| `ARCHITECTURE.md` | Tài liệu kiến trúc cấp cao được làm mới từ GitNexus snapshot, mô tả clusters và execution flows chính. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `api/` | Tài liệu tham chiếu cho Gemini, Imagen, Kling, GPT Image, Nano Banana, và các API liên quan (xem `api/AGENTS.md`). |
| `superpowers/` | Planning artifacts và agent-facing implementation plans được giữ lại trong repo (xem `superpowers/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Ưu tiên mô tả những gì đang thực sự tồn tại trong repo; không dẫn chiếu các docs đã bị xóa như thể còn là source of truth.
- Khi thay đổi workflow, provider integration, hoặc model routing trong code, cân nhắc cập nhật tài liệu liên quan ở đây.
- `ARCHITECTURE.md` là entrypoint tốt nhất để hiểu hệ thống ở mức cao trước khi đọc code chi tiết.

### Testing Requirements
- Không có build riêng cho docs, nhưng mọi mô tả phải khớp với file thực tế trong repo.
- Khi docs nói về code paths, xác minh lại đường dẫn và tên file trước khi commit.

### Common Patterns
- `ARCHITECTURE.md` thiên về system overview và graph-derived flows.
- `api/` lưu vendor references để tránh phải đoán API behavior trong khi implement.
- `superpowers/` lưu plan docs có tính lịch sử; không phải mọi plan đều phản ánh trạng thái code hiện tại.

## Dependencies

### Internal
- `../src/` là nguồn dữ liệu chính cho mọi mô tả kỹ thuật.
- `../plans/` chứa thêm các artifact lập kế hoạch ngoài nhánh docs chính.

### External
- Tài liệu vendor/API được sao chép hoặc tóm lược từ nhà cung cấp tương ứng.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
