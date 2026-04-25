<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-26 | Updated: 2026-04-26 -->

# locales

## Purpose
Translation dictionaries cho toàn bộ UI. `en.ts` là source of truth về key structure; `vi.ts` phải mirror cùng shape để language switching hoạt động nhất quán.

## Key Files
| File | Description |
|------|-------------|
| `en.ts` | English source of truth và exported `Translation` type. |
| `vi.ts` | Vietnamese translation mirror cho cùng key tree. |

## Subdirectories
Không có thư mục con đáng kể trong phạm vi sản phẩm.

## For AI Agents

### Working In This Directory
- Thêm key vào `en.ts` trước, sau đó mirror sang `vi.ts`.
- Không đổi key path tùy tiện nếu UI/tests đang assert trực tiếp trên i18n keys.
- Giữ `Translation = typeof en` để TypeScript phát hiện mismatch khi có thể.
- Dùng key có nghĩa theo feature/surface, không hardcode text trong component.

### Testing Requirements
- Sau khi sửa translation shape, chạy `npx tsc --noEmit` để bắt mismatch type-level.
- Nếu tests mock `t()` trả key, cập nhật assertions khi key path thay đổi.

### Common Patterns
- UI gọi `const { t } = useLanguage(); t('key.path')`.
- Nhiều component tests assert text bằng key thay vì bản dịch thật.
- English dictionary giữ vai trò schema mềm cho toàn bộ localization tree.

## Dependencies

### Internal
- `../contexts/LanguageContext.tsx` dùng dictionaries để resolve translation.
- `../components/` và `../hooks/` tiêu thụ keys qua `useLanguage()`.
- `../../__tests__/` có nhiều assertions dựa trên key names.

### External
- Không có runtime translation service; toàn bộ i18n nằm local trong repo.

<!-- MANUAL: Add durable notes below this line; regeneration should preserve them. -->
