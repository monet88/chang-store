<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# components

## Purpose
UI layer của ứng dụng: feature screens, shared controls, modal surfaces, và các presentation-only building blocks. Phần lớn file ở đây là thin wrappers lấy state/handlers từ hooks và render workspace theo hướng media-first.

## Key Files
| File | Description |
|------|-------------|
| `Header.tsx` | Workspace header và feature navigation shell. |
| `UtilityDock.tsx` | Entry point cho gallery, prompt library, và studio utilities. |
| `GlobalModelSelector.tsx` | Bộ chọn model theo selection scope đang active. |
| `VirtualTryOn.tsx` | Feature screen cho try-on workflow, dùng hook tương ứng để điều phối logic. |
| `PatternGenerator.tsx` | Feature screen cho pattern generation flow mới hơn. |
| `ImageEditor.tsx` | Feature surface lớn nhất, đóng vai trò orchestrator cho editor canvas/toolbar. |
| `Toast.tsx` | Toast provider và `useToast()` nằm inline tại đây, không ở `contexts/`. |
| `LookbookGenerator.prompts.ts` | Prompt constants co-located với lookbook UI flow. |
| `predefinedContent.ts` | Dữ liệu tĩnh cho backgrounds/poses và lựa chọn dựng sẵn. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `modals/` | Dialog surfaces như gallery, settings, prompt library, và pose selection (xem `modals/AGENTS.md`). |
| `shared/` | Reusable UI pieces dùng xuyên nhiều features (xem `shared/AGENTS.md`). |
| `upscale/` | Step-based sub-components cho upscale workflow (xem `upscale/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- Giữ components mỏng: state, validation, API calls, và gallery integration phải nằm trong hook ghép cặp.
- Không gọi services trực tiếp từ component mới; route qua hook.
- Khi thêm feature component, đồng bộ với `src/hooks/`, `src/App.tsx`, và `src/locales/`.
- Dùng Tailwind classes; tránh inline styles và tránh đưa business logic vào JSX.

### Testing Requirements
- Rendering và interaction bề mặt nên được test trong `__tests__/components/`.
- Nếu component chỉ là wrapper, phần lớn logic nên được test ở hook tương ứng.
- Với thay đổi UI lớn, kiểm tra manual feature flow trong app ngoài test suite.

### Common Patterns
- Components thường dùng `React.FC` theo convention hiện có của project.
- Parent feature component lấy `{ state, handlers }` từ hook rồi đẩy xuống presentational children.
- `App.tsx` lazy-load gần như toàn bộ feature screens và modal surfaces.

## Dependencies

### Internal
- `../hooks/` cho state và business logic.
- `../contexts/` cho global state như language, API config, gallery, và viewer.
- `../config/` cho model selector UI.

### External
- `react` cho component model.
- Tailwind utility classes qua pipeline của project.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
