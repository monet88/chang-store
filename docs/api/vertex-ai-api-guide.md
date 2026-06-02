# CLI Proxy API Guide — Vertex AI / Imagen 4

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
| `POST` | `/v1/completions` | OpenAI-compatible |
| `GET`  | `/v1/models` | OpenAI-compatible |
| `POST` | `/v1beta/models/{model}:generateContent` | Google Gemini-style |
| `POST` | `/v1beta/models/{model}:predict` | Google Vertex-style |
| `GET`  | `/v1beta/models` | Google-style model list |

---

## Available Models

### Image Generation

| Model ID | Provider | Status | Notes |
|----------|----------|--------|-------|
| `imagen-4.0-ultra-generate-001` | Google | ⚠️ Quota limited | High quality, bị rate limit thường xuyên |
| `imagen-4.0-fast-generate-001` | Google | ✅ OK | Nhanh (~8s), chất lượng tốt |
| `gpt-image-2` | OpenAI | Available | Chưa test |

### Text / Multimodal

| Model ID | Provider |
|----------|----------|
| `gemini-2.5-flash` | Google |
| `gemini-3-pro-preview` | Google |
| `gemini-3-flash-preview` | Google |
| `gemini-3.1-pro` | Google |
| `gemini-3.1-flash-image-preview` | Google |
| `gemini-3-pro-image-preview` | Google |
| `gpt-5.5` | OpenAI |
| `gpt-5.4-mini` | OpenAI |
| `claude-opus-4-6` | Anthropic |
| `claude-sonnet-4-6` | Anthropic |
| `claude-haiku-4-5` | Anthropic |
| `grok-4.20-multi-agent-0309` | xAI |
| `grok-4.20-0309-reasoning` | xAI |
| `deepseek-v4-flash` | DeepSeek |
| `deepseek-v4-pro` | DeepSeek |

### Video Generation

| Model ID | Provider |
|----------|----------|
| `grok-imagine-video` | xAI |
| `grok-imagine-video-1.5-preview` | xAI |

---

## Image Generation — Usage Examples

### 1. OpenAI-Compatible (Recommended)

```bash
curl -X POST https://cliproxy.monet.uno/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api-key>" \
  -d '{
    "model": "imagen-4.0-fast-generate-001",
    "messages": [{
      "role": "user",
      "content": "A professional product photo of white sneakers on a marble surface"
    }]
  }'
```

**Response:**

```json
{
  "id": "imagen-1780385828284721897",
  "object": "chat.completion",
  "model": "imagen-4.0-fast-generate-001",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": null,
      "images": [{
        "type": "image_url",
        "image_url": {
          "url": "data:image/png;base64,iVBORw0KGgo..."
        }
      }]
    },
    "finish_reason": "stop"
  }]
}
```

**Trích xuất ảnh (JavaScript):**

```javascript
const response = await fetch('https://cliproxy.monet.uno/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'imagen-4.0-fast-generate-001',
    messages: [{ role: 'user', content: prompt }]
  })
});

const json = await response.json();
const dataUrl = json.choices[0].message.images[0].image_url.url;
// dataUrl = "data:image/png;base64,..."
```

### 2. Google Gemini-Style (v1beta generateContent)

```bash
curl -X POST https://cliproxy.monet.uno/v1beta/models/imagen-4.0-fast-generate-001:generateContent \
  -H "Content-Type: application/json" \
  -H "x-api-key: <api-key>" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "A professional product photo of white sneakers"
      }]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE"]
    }
  }'
```

**Response:**

```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "inlineData": {
          "data": "iVBORw0KGgo...",
          "mimeType": "image/png"
        }
      }]
    }
  }]
}
```

### 3. Google Vertex-Style (v1beta predict)

```bash
curl -X POST https://cliproxy.monet.uno/v1beta/models/imagen-4.0-fast-generate-001:predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api-key>" \
  -d '{
    "instances": [{
      "prompt": "A professional product photo of white sneakers"
    }],
    "parameters": {
      "sampleCount": 1,
      "aspectRatio": "1:1"
    }
  }'
```

> ⚠️ Endpoint predict trả về response trống trong test. Ưu tiên dùng `/v1/chat/completions` hoặc `generateContent`.

---

## Error Handling

### 429 — Quota Exceeded

```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded for aiplatform.googleapis.com/online_prediction_requests_per_base_model with base model: imagen-4.0-ultra-generate.",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

**Xử lý:** Fallback từ `ultra` sang `fast`, hoặc retry sau vài giây.

### Fallback Strategy

```
imagen-4.0-ultra-generate-001  →  imagen-4.0-fast-generate-001  →  gpt-image-2
```

---

## Integration Notes

- **Output format:** PNG, base64-encoded trong response
- **Image size:** ~1.3 MB per image (1024×1024)
- **Latency:** ~8s cho `fast`, chưa đo được `ultra` (quota limited)
- **Rate limits:** `ultra` model bị quota giới hạn nghiêm ngặt hơn `fast`
- **Không cần Google Cloud credentials** — proxy xử lý auth phía server
