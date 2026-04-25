<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# hooks

## Purpose
Tầng logic của ứng dụng. Mỗi feature hook chịu trách nhiệm state, validation, orchestration, error handling, và giao tiếp với contexts/services; UI components chỉ tiêu thụ dữ liệu từ đây.

## Key Files
| File | Description |
|------|-------------|
| `useVirtualTryOn.ts` | Batch try-on workflow với per-item processing và gallery integration. |
| `useLookbookGenerator.ts` | Lookbook generation, refinement, draft persistence, và variations flow. |
| `useUpscale.ts` | Multi-phase upscale orchestration cho Studio và Quick modes. |
| `useGoogleDriveSync.ts` | Queue-based Google Drive sync flow cho gallery operations. |
| `useImageEditor.ts` | State orchestration cho editor workflow và image editing controls. |
| `usePatternGenerator.ts` | Logic cho pattern generation flow và prompt-driven image outputs. |
| `useCanvasDrawing.ts` | Shared drawing/mask logic cho canvas-based flows. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Hooks phải giữ toàn bộ business logic; đừng đẩy logic ngược lên component.
- Mọi async flow nên theo mẫu `try/catch/finally` với `getErrorMessage(err, t)` để giữ i18n nhất quán.
- Không lưu API key hoặc provider config trong local hook state; lấy từ `ApiProviderContext`.
- Khi thêm feature hook mới, ghép cặp rõ ràng với component cùng tên ở `src/components/`.

### Testing Requirements
- Kiểm thử hành vi trong `__tests__/hooks/` bằng `renderHook` + `act`.
- Nếu thay đổi side effects hoặc service interactions, thêm cả success path lẫn rejection path.
- Sau thay đổi logic lớn, chạy `npm run test` cho suite liên quan.

### Common Patterns
- Hooks thường dùng `useLanguage()`, `useApi()`, và khi cần thì `useImageGallery()`.
- Batch workflows dùng `useRef` cho counters/queues và helper `run-bounded-workers.ts`.
- Hook return shape thường gom vào `state` và `handlers` để component tiêu thụ gọn hơn.

## Dependencies

### Internal
- `../components/` là lớp UI tiêu thụ hooks.
- `../services/` cho API/service facade calls.
- `../contexts/` cho global state và persistence-backed behavior.
- `../utils/` cho prompt builders, error formatting, và concurrency helpers.

### External
- React hooks API.
- Vitest/RTL trong `__tests__/hooks/` để xác minh hành vi.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
