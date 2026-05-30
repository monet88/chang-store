---
date: 2026-05-30
status: draft
source: brainstorm
scope: GPT Image 2 + Grok Image provider integration
related-files:
  - src/services/imageEditingService.ts
  - src/services/gemini/image.ts
  - src/config/modelRegistry.ts
  - src/contexts/ApiProviderContext.tsx
  - src/hooks/useSettingsModal.ts
  - src/hooks/useModelSelection.ts
  - docs/api/gpt-image-2-api-guide.md
  - docs/api/grok-image-api-guide.md
---

# GPT Image 2 + Grok Image Provider Routing

## Tóm tắt

Mục tiêu là thêm `gpt-image-2` và 2 model Grok image vào app mà không làm vỡ luồng hiện có, không đụng UI nhiều, và giữ Gemini làm default.

Sau scout, thấy kiến trúc hiện tại là:

`Component → Hook → Service facade → Gemini service`

Điểm móc chính:

- `src/services/imageEditingService.ts:13-241` là facade cho edit/generate/upscale.
- `src/services/gemini/image.ts:19-229` chứa logic API Gemini thực tế.
- `src/config/modelRegistry.ts:36-188` là single source of truth cho model list + default.
- `src/contexts/ApiProviderContext.tsx:23-112` lưu model đã chọn trong `localStorage`.
- `src/hooks/useSettingsModal.ts:45-229` và `src/hooks/useModelSelection.ts:23-69` render model picker từ registry.

Docs cho provider mới cho thấy khác biệt lớn ở request shape:

- GPT Image 2 edit: `multipart/form-data`, `image` file upload, `n` thực tế bị ignore, có thể cần retry khi gặp `auth_unavailable (503)`.
- Grok Image edit: JSON body, field `images` là array base64 data URI, giới hạn reference images khác nhau giữa `grok-imagine-image` và `grok-imagine-image-quality`.

## Kết luận chính

Cách tốt nhất là **không thêm provider dropdown riêng ngay bây giờ**. Nên giữ UI chọn model hiện tại, rồi route theo `modelId` ở tầng service.

## Thiết kế đề xuất

### 1) Mở rộng `modelRegistry` thành nơi chứa provider metadata

Giữ flow hiện tại, chỉ thêm metadata cho từng model:

- `providerId`
- `modelId`
- `label`
- `selectionType`
- capability flags cần cho UI/service

Tùy mức cần, capability nên mở rộng thêm:

- `supportsImageSize`
- `supportsAspectRatio`
- `maxReferenceImages`
- `requestFormat` hoặc `inputMode` nếu cần phân biệt multipart vs JSON

Lý do: UI đã đọc model từ registry, nên thêm model mới sẽ tự xuất hiện trong Settings mà không phải đổi logic component.

### 2) Tách provider adapter ở tầng service

Tạo các adapter riêng theo provider, ví dụ:

- `src/services/providers/gemini/image.ts`
- `src/services/providers/openai/image.ts`
- `src/services/providers/grok/image.ts`

Mỗi adapter implement cùng một interface nội bộ kiểu:

- `generateImage(...)`
- `editImage(...)`
- `upscaleImage(...)`

`src/services/imageEditingService.ts` chỉ làm việc sau:

1. resolve model
2. lấy `providerId` từ registry
3. dispatch sang adapter tương ứng
4. log kết quả chung

Điểm quan trọng: **không để request-shape quirks lọt lên component/hook**.

### 3) Giữ `ApiProviderContext` như hiện tại

Không thêm state provider riêng trong context lúc này.

Lý do:

- current state đã đủ để lưu `imageEditModel`, `imageGenerateModel`, `textGenerateModel`
- model id đã đủ để suy ra provider từ registry
- thêm provider state riêng sẽ làm blast radius lớn hơn mà chưa cần thiết

### 4) Giữ Gemini làm default

Default/fallback nên không đổi:

- `imageEdit` → Gemini hiện tại
- `imageGenerate` → Gemini hiện tại
- `textGenerate` → Gemini hiện tại

Điều này giữ backward compatibility, nhất là vì GPT Image 2 có retry/stability khác và Grok có giới hạn input khác.

## Vì sao cách này ít conflict

### Ít đụng UI

`SettingsModal`, `useSettingsModal`, `useModelSelection` đều lấy dữ liệu từ registry. Chỉ cần thêm entry mới là xong.

### Ít đụng state

Không tách provider state ra khỏi model state nên không tạo thêm state machine mới.

### Ít đụng luồng hiện có

Gemini flow giữ nguyên, chỉ thêm router phía trên. Nếu provider mới lỗi, không phá Gemini path.

### Rõ boundary

- UI chỉ biết model
- registry biết model thuộc provider nào
- service adapter biết API shape của provider đó

## So sánh phương án

### Phương án A — Branch theo `modelId` trong `imageEditingService.ts`

**Ưu:** nhanh nhất để làm.

**Nhược:**

- code sẽ nhanh chóng thành `if/else` rối
- khó test từng provider độc lập
- dễ lẫn request shape và retry logic
- conflict cao khi sau này thêm provider thứ 4

**Kết luận:** không khuyến nghị.

### Phương án B — Provider registry + adapter layer ẩn sau service facade

**Ưu:**

- sạch nhất
- dễ mở rộng
- test được từng provider riêng
- giữ UI ổn định
- ít xung đột nhất với code hiện tại

**Nhược:**

- cần thêm 1 lớp abstraction
- initial refactor nhiều hơn phương án A

**Kết luận:** khuyến nghị.

### Phương án C — Thêm provider dropdown riêng trong UI

**Ưu:** user nhìn rõ provider/model nào đang dùng.

**Nhược:**

- tăng state/UI complexity
- đụng nhiều component và hook hơn
- chưa cần thiết vì modelId đã đủ để route provider

**Kết luận:** để phase sau, chỉ làm khi thật sự cần multi-provider UX explicit.

## Rủi ro và mitigations

### 1) Model name collision

Nếu sau này 2 provider dùng cùng `modelId`, registry hiện tại có thể bị mơ hồ.

**Mitigation:**

- giữ `providerId` là metadata bắt buộc
- nếu cần, cho phép qualified id kiểu `provider:modelId`
- nhưng phải update `isKnownModelForSelectionType` để không reject qualified ids

### 2) Capability mismatch

`getModelCapabilities` hiện chỉ xử lý `supportsImageSize` và `supportsAspectRatio`.

**Mitigation:**

- mở rộng capability schema thay vì hardcode trong service
- để adapter tự xử lý trường hợp provider không hỗ trợ flag nào đó

### 3) GPT Image 2 stability

Docs ghi có thể gặp `auth_unavailable (503)` sau nhiều request.

**Mitigation:**

- retry riêng trong adapter GPT, không lan ra global retry chung
- backoff có giới hạn, không retry vô hạn

### 4) Grok edit input cap

Grok edit có giới hạn số ảnh reference khác nhau theo model.

**Mitigation:**

- enforce limit ở adapter, trả error sớm trước khi gọi API
- message lỗi rõ ràng cho UI

## Validation criteria

Nếu làm đúng, phải đạt các điều này:

- Gemini flow cũ vẫn chạy y như trước
- Settings vẫn hiện model theo registry, không cần provider dropdown
- GPT Image 2 edit dùng multipart form đúng format
- Grok edit dùng JSON `images[]` đúng format
- default vẫn là Gemini
- test cho service routing pass
- test cho model registry pass
- không có direct provider logic trong component/hook

## Khuyến nghị cuối

**Làm theo hướng B: provider registry + service adapter layer, giữ UI hiện tại, giữ Gemini default.**

Đây là cách ít conflict nhất vì:

- đổi ít file UI
- tách biệt request-shape khác nhau
- dễ test
- dễ mở rộng thêm provider sau này
- không phá behavior đang có

## Next step

Nếu bạn đồng ý hướng này, bước tiếp theo nên là đi vào `/ck:plan` để chia phase rõ ràng:

1. mở rộng registry/capabilities
2. thêm provider adapter
3. nối router vào `imageEditingService`
4. thêm tests
5. kiểm tra build + lint + typecheck
