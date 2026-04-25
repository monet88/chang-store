<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# services tests

## Purpose
Tests cho service facade routing, Gemini provider behavior, Google Drive service behavior, API client setup, và upscale analysis service. Đây là lớp đảm bảo hooks không phải biết chi tiết provider implementation.

## Key Files
| File | Description |
|------|-------------|
| `imageEditingService.test.ts` | Routing và parameter forwarding qua image editing facade. |
| `apiClient.test.ts` | Gemini client creation/key behavior. |
| `googleDriveService.test.ts` | Drive API requests và error handling. |
| `upscaleAnalysisService.test.ts` | Upscale analysis orchestration và response handling. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `gemini/` | Provider-specific Gemini service tests (xem `gemini/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Mock provider modules khi test facade routing; mock network/fetch khi test lower-level services.
- Không mock module đang được test; chỉ mock dependencies của nó.
- Khi thêm service branch mới, assert đúng target provider function được gọi với params cần thiết.

### Testing Requirements
- Chạy `npm run test -- __tests__/services/<file>.test.ts` khi sửa service tương ứng.
- Test error propagation; đừng chỉ test success path.
- Restore global mocks như `fetch` trong `afterEach` khi đụng browser APIs.

### Common Patterns
- Facade tests mock `src/services/gemini/*` và assert routing.
- Provider tests mock SDK/fetch responses và kiểm tra parsing/errors.
- Structured error keys như `error.api.safetyBlock` nên được assert trực tiếp.

## Dependencies

### Internal
- `../../src/services/` là code under test.
- `../__mocks__/` cung cấp SDK/network mocks khi cần.

### External
- Vitest mocking, browser fetch mock shape, và `@google/genai` mock modules.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
