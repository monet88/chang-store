# CLI Proxy API Guide — Vertex AI / Gemini

> Tested: 2026-06-02  
> Base URL: `https://cliproxy.monet.uno`  
> API Key: Stored in environment — use `VITE_CLIPROXY_API_KEY`

---

## Authentication

Hai cách xác thực đều hoạt động:

```
Authorization: Bearer <api-key>
x-api-key: <api-key>
```

---

## Available Endpoints

| Method | Path | Style |
|--------|------|-------|
| `POST` | `/v1/chat/completions` | OpenAI-compatible |
| `GET`  | `/v1/models` | OpenAI-compatible |
| `POST` | `/v1beta/models/{model}:generateContent` | Google Gemini-style |
| `GET`  | `/v1beta/models` | Google-style model list |

---

## Available Models

### Text / Multimodal

| Model ID | Provider | Status | Notes |
|----------|----------|--------|-------|
| `gemini-3.5-flash` | Google | ✅ OK | Hoạt động tốt |
| `gemini-3.1-pro-preview` | Google | ✅ OK | Hoạt động tốt |
| `gemini-3-flash-preview` | Google | ✅ OK | Hoạt động tốt |
| `gemini-3.1-flash-lite-preview` | Google | ✅ OK | Hoạt động tốt |
| `gemini-2.5-flash` | Google | ✅ OK | Hoạt động tốt |
| `gemini-2.5-pro` | Google | ✅ OK | Hoạt động tốt (Hỗ trợ reasoning) |

### Image

| Model ID | Provider | Status | Notes |
|----------|----------|--------|-------|
| `gemini-3.1-flash-image-preview` | Google | ✅ OK | Phiên bản hoạt động được của dòng 3.1 flash image |
| `gemini-3-pro-image-preview` | Google | ✅ OK | Phiên bản hoạt động được, chất lượng cao |
| `gemini-2.5-flash-image` | Google | ✅ OK | Hoạt động tốt |

---

## Usage Examples

### 1. OpenAI-Compatible (v1/chat/completions)

```bash
curl -X POST https://cliproxy.monet.uno/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api-key>" \
  -d '{
    "model": "gemini-3.5-flash",
    "messages": [{
      "role": "user",
      "content": "Hello!"
    }]
  }'
```

**Response:**

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1780417560,
  "model": "gemini-3.5-flash",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }]
}
```

### 2. Google Gemini-Style (v1beta generateContent)

```bash
curl -X POST https://cliproxy.monet.uno/v1beta/models/gemini-3.5-flash:generateContent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <api-key>" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello!"
      }]
    }]
  }'
```

---

## Integration Notes

- **Cảnh báo lỗi 502 cho model mặc định:** Mặc dù mã nguồn của ứng dụng hiện tại đang đăng ký mặc định dùng `gemini-3.1-flash-image` (cho image edit/generate) và `gemini-3.5-flash` (cho text generation), nhưng khi gọi qua proxy các model Gemini 3.0/3.1 không có suffix `-preview` sẽ bị lỗi **HTTP 502 (unknown provider)**. Cần chuyển image model sang bản preview tương ứng: `gemini-3.1-flash-image-preview`; text model mặc định `gemini-3.5-flash` không cần suffix.
- **Bắt buộc sử dụng suffix `-preview`:** Bắt buộc đối với toàn bộ các model Gemini thuộc dòng 3.0 và 3.1 để proxy nhận diện được provider (ví dụ: `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`).
- **Dòng Gemini 2.5 và 3.5:** Các model thuộc dòng 2.5 (như `gemini-2.5-flash`, `gemini-2.5-flash-image`) và 3.5 (như `gemini-3.5-flash`) hoạt động tốt mà không cần suffix `-preview`.
- **Không cần Google Cloud credentials:** Proxy xử lý xác thực (authentication) và phân quyền ở phía server, ứng dụng client chỉ cần sử dụng API Key cấu hình trong môi trường.

---

## Re-verified 2026-09-17 (làn Gemini vs làn ảnh)

> Đo lại trực tiếp trên `https://cliproxy.monet.uno`. Phần "Bắt buộc suffix `-preview`" ở trên
> **không còn đúng** với build hiện tại.

| Đo được | Kết quả |
| --- | --- |
| `GET /v1/models` | 200, **32 model** (0.23 s). Nhóm ảnh: `gemini-3.1-flash-image`, `agy/gemini-3.1-flash-image`, `gpt-image-2`, `gpt-image-2.5`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` |
| `gemini-3.1-flash-image` (không `-preview`) | **200** trên `/v1beta/models/{id}:generateContent`; alias `agy/gemini-3.1-flash-image` cũng 200 |
| `imageConfig.aspectRatio` + `imageSize` | **được tôn trọng chính xác**: 9:16 @1K/2K/4K = 768x1376 / 1536x2752 / 3072x5504; 1:1 @2K = 2048x2048; 3:4 @2K = 1792x2400. Ảnh trả về `parts[].inlineData`, **image/jpeg** |
| Không gửi `imageConfig` | trả **1408x768 (ảnh ngang)** ⇒ luôn gửi `aspectRatio` tường minh |
| `/v1/images/generations` trên gateway này | chỉ nhận `gpt-image-*` / `grok-imagine-*`; `gemini-3.1-flash-image` ⇒ 400 kèm danh sách model được hỗ trợ. Với `gpt-image-*` thì **`size` và `quality` bị bỏ qua** (luôn 1254x1254; `gpt-image-2.5` ra 1369x1149) |

⇒ Gateway này là **làn Gemini** của app (`configureGeminiClient`). Việc tạo ảnh OpenAI-style
đi qua gateway chuyên (`docs/api/xompet-image-api-guide.md`), không đi qua đây. Chi tiết đầy đủ
và bằng chứng: `docs/stories/epics/E04-provider-gateways/US-006-gateway-image-model-routing/`.
