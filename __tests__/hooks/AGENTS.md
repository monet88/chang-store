<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# hooks tests

## Purpose
Hook-level tests cho state machines, async operations, service calls, gallery side effects, và error handling. Đây là nơi kiểm thử business logic chính của feature hooks.

## Key Files
| File | Description |
|------|-------------|
| `useVirtualTryOn.test.tsx` | Batch try-on, service calls, và result handling behavior. |
| `useLookbookGenerator.test.tsx` | Lookbook draft/refinement state và generation flow. |
| `useUpscale.test.tsx` | Studio/Quick upscale workflow state transitions. |
| `useClothingTransfer.test.tsx` | Clothing transfer hook orchestration và error cases. |
| `useOutfitAnalysis.test.tsx` | Outfit analysis workflow behavior. |
| `usePatternGenerator.test.tsx` | Pattern generator hook state và generation behavior. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Dùng `renderHook` + `act` cho state updates, đặc biệt với async handlers.
- Mock contexts và services ở module level trước import hook under test.
- Test cả happy path, validation failure, service rejection, và cleanup/loading reset khi hook có async work.

### Testing Requirements
- Chạy single-file test khi sửa hook tương ứng: `npm run test -- __tests__/hooks/<file>.test.tsx`.
- Với hook dùng timers/debounce, dùng fake timers và reset về real timers sau test.

### Common Patterns
- `vi.mocked(serviceFn).mockResolvedValueOnce(...)` cho service responses.
- `createAllContextMocks()` hoặc mock factories trong `__mocks__/contexts.tsx` giúp giảm duplication.
- Assertions nên quan sát state/output public của hook, không nội bộ implementation.

## Dependencies

### Internal
- `../../src/hooks/` là code under test.
- `../__mocks__/contexts.tsx` cho reusable context mocks.
- `../../src/services/` thường được mock để cô lập hook behavior.

### External
- Vitest, React Testing Library hook utilities qua `@testing-library/react`.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
