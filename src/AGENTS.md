<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# src

## Purpose
Mã nguồn chính của ứng dụng React 19 + TypeScript + Vite. Thư mục này chứa app shell, feature components, hooks, service facade, contexts, model config, i18n, và các utility thuần dùng để dựng virtual fashion studio.

## Key Files
| File | Description |
|------|-------------|
| `App.tsx` | App shell, provider stack, lazy feature switching, modal orchestration, và workspace navigation. |
| `index.tsx` | Vite entrypoint khởi tạo React tree. |
| `types.ts` | Shared enums và contracts xuyên suốt UI, hooks, services, và config. |
| `index.css` | Global styles và Tailwind-driven shell styling cho toàn app. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `components/` | UI layer với feature screens, modal dialogs, và shared presentation pieces (xem `components/AGENTS.md`). |
| `hooks/` | Feature logic, state orchestration, validation, và side effects (xem `hooks/AGENTS.md`). |
| `services/` | Stateless service facades và Gemini integrations (xem `services/AGENTS.md`). |
| `contexts/` | Global providers cho language, API config, gallery, Drive, và viewer state (xem `contexts/AGENTS.md`). |
| `utils/` | Pure helpers, prompt builders, image helpers, storage helpers, và worker utilities (xem `utils/AGENTS.md`). |
| `config/` | Model registry, capabilities, và feature-to-scope selection rules (xem `config/AGENTS.md`). |
| `locales/` | Translation dictionaries; `en.ts` là source of truth (xem `locales/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Giữ đúng flow kiến trúc: `Component → Hook → Service Facade → Gemini/API layer`.
- Không có React Router; `App.tsx` chuyển feature bằng `Feature` enum và `React.lazy`.
- Khi thêm feature mới, cập nhật theo thứ tự: `types.ts` → component → hook → `App.tsx` → `locales/en.ts` → `locales/vi.ts`.
- Giữ component mỏng; mọi business logic, state transitions, và service calls phải nằm trong hook tương ứng.

### Testing Requirements
- Sau thay đổi đáng kể trong `src/`, chạy `npx tsc --noEmit` và `npm run lint`.
- Nếu thay đổi logic hành vi, cập nhật hoặc thêm test phản chiếu trong `__tests__/`.
- Với thay đổi UI đáng kể, kiểm tra manual flow của feature liên quan trước khi kết luận.

### Common Patterns
- Provider nesting trong `App.tsx`: `LanguageProvider → ToastProvider → ApiProvider → GoogleDriveProvider → ImageGalleryProvider → ImageViewerProvider`.
- Path alias `@/*` trỏ về `src/`.
- `types.ts` là hợp đồng chia sẻ giữa UI, hooks, services, và config.

## Dependencies

### Internal
- `../__tests__/` xác nhận hành vi cho hooks, services, contexts, và utilities.
- `../docs/ARCHITECTURE.md` mô tả kiến trúc cấp cao và execution flows.
- `../types/` chứa ambient browser typings dùng bởi một số integration bề mặt.

### External
- `react`, `react-dom` cho UI runtime.
- `vite` và `typescript` cho build/dev workflow.
- `tailwindcss` cho styling utilities.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
