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

- **Cảnh báo lỗi 502 cho model mặc định:** Mặc dù mã nguồn của ứng dụng hiện tại đang đăng ký mặc định dùng `gemini-3.1-flash-image` (cho image edit/generate) và `gemini-3.1-flash-lite` (cho text generation), nhưng khi gọi qua proxy các model này sẽ bị lỗi **HTTP 502 (unknown provider)**. Cần chuyển sang sử dụng bản preview tương ứng: `gemini-3.1-flash-image-preview` và `gemini-3.1-flash-lite-preview`.
- **Bắt buộc sử dụng suffix `-preview`:** Bắt buộc đối với toàn bộ các model Gemini thuộc dòng 3.0 và 3.1 để proxy nhận diện được provider (ví dụ: `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`).
- **Dòng Gemini 2.5 và 3.5:** Các model thuộc dòng 2.5 (như `gemini-2.5-flash`, `gemini-2.5-flash-image`) và 3.5 (như `gemini-3.5-flash`) hoạt động tốt mà không cần suffix `-preview`.
- **Không cần Google Cloud credentials:** Proxy xử lý xác thực (authentication) và phân quyền ở phía server, ứng dụng client chỉ cần sử dụng API Key cấu hình trong môi trường.
