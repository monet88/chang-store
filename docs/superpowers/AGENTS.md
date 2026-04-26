<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# superpowers

## Purpose
Agent-oriented planning artifacts và workflow notes. Hiện thư mục này chủ yếu là container cho plans đã được tạo trong các phiên trước, không phải code runtime.

## Key Files
Không có file cấp trực tiếp đáng kể ngoài thư mục con.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `plans/` | Implementation plans và review outcomes từ các superpowers workflows (xem `plans/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Đọc artifacts ở đây như historical context; đối chiếu với code hiện tại trước khi thực thi.
- Không giả định plan cũ vẫn còn đúng nếu implementation đã thay đổi.
- Giữ tài liệu mới có tiêu đề, goal, file scope, và trạng thái review rõ ràng nếu thêm vào đây.

### Testing Requirements
- Không có test riêng cho planning docs.
- Nếu dùng plan để sửa code, verify bằng test/checks ở layer code liên quan.

### Common Patterns
- Thư mục con `plans/` chứa markdown theo ngày hoặc feature-specific plan.
- Nội dung thường hướng dẫn agentic implementation theo checkbox tasks.

## Dependencies

### Internal
- `../../src/` để đối chiếu implementation.
- `../ARCHITECTURE.md` cho system context.

### External
- Không có runtime dependency.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
