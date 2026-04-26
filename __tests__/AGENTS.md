<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# __tests__

## Purpose
Test suite của dự án dùng Vitest + React Testing Library + jsdom. Cấu trúc thư mục phản chiếu `src/` để kiểm thử component rendering, hook logic, service routing, provider behavior, config rules, mocks, và image fixtures.

## Key Files
| File | Description |
|------|-------------|
| `App.test.tsx` | Smoke-level coverage cho app shell và navigation behavior quan trọng. |
| `AGENTS.md` | Bản đồ testing architecture và conventions cấp thư mục test. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `components/` | Component tests tập trung vào rendering và interaction bề mặt (xem `components/AGENTS.md`). |
| `hooks/` | Hook tests cho state transitions, async flows, và error handling (xem `hooks/AGENTS.md`). |
| `services/` | Service routing, parameter forwarding, và provider-specific behavior tests (xem `services/AGENTS.md`). |
| `utils/` | Pure utility và prompt builder tests (xem `utils/AGENTS.md`). |
| `contexts/` | Provider tests cho persistence, guards, và shared state behavior (xem `contexts/AGENTS.md`). |
| `config/` | Model selection rule tests (xem `config/AGENTS.md`). |
| `__mocks__/` | Shared mock factories và module-level mocks tái sử dụng giữa nhiều test suites (xem `__mocks__/AGENTS.md`). |
| `images-test/` | Image fixtures dùng trong service/integration-style tests (xem `images-test/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Giữ cấu trúc test phản chiếu `src/` để dễ lần theo feature hoặc layer tương ứng.
- Trong test files, khai báo `vi.mock()` trước khi import code under test.
- Component tests chỉ nên xác nhận rendering và user interaction; business logic sâu nằm ở hook/service tests.

### Testing Requirements
- Chạy `npm run test` khi thay đổi logic đã có test coverage ở đây.
- Với thay đổi lớn trong hooks/services, ưu tiên cập nhật test ở cùng layer thay vì đẩy toàn bộ trách nhiệm sang component tests.
- Giữ mocks cô lập bằng `vi.clearAllMocks()` trong `beforeEach`.

### Common Patterns
- `t()` thường được mock để trả về key, nên assertions có thể dùng trực tiếp i18n keys.
- Hook tests dùng `renderHook` + `act` để bao phủ async state transitions.
- Shared mock factories trong `__mocks__/contexts.tsx` hỗ trợ partial overrides.

## Dependencies

### Internal
- `../src/` là code under test cho toàn bộ suites.
- `../setupTests.ts` nạp `@testing-library/jest-dom` cho assertions DOM.

### External
- `vitest` cho test runner và mocking.
- `@testing-library/react` và `jsdom` cho DOM-oriented tests.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
