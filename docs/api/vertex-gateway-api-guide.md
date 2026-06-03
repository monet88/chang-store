# Vertex Gateway API Guide

> Tested: 2026-06-03
> Base URL: `<gateway-origin>`  
> Gateway API Key: set by `GATEWAY_API_KEYS` on the gateway server

---

## Purpose

Guide này áp dụng cho backend gateway trong thư mục `gateway/`, không áp dụng cho `https://cliproxy.monet.uno`.

Gateway nhận request từ browser/app bằng gateway key, sau đó tự xác thực lên Google Vertex AI ở phía server bằng service account JSON hoặc ADC. Client không được gửi Google Cloud credentials.

---

## Authentication

Hai cách xác thực gateway đều hoạt động:

```
Authorization: Bearer <gateway-api-key>
x-api-key: <gateway-api-key>
```

---

## Upstream Google Auth

Gateway xác thực lên Vertex AI ở phía server.

Yêu cầu phổ biến nhất:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
GOOGLE_VERTEX_PROJECT=<gcp-project-id>
GOOGLE_VERTEX_LOCATION=global
```

File credentials phải là service account key JSON có các field top-level như:

- `type: "service_account"`
- `project_id`
- `client_email`
- `private_key`

OAuth client JSON với top-level `installed` hoặc `web` sẽ bị reject.

---

## Available Endpoints

| Method | Path | Style | Notes |
|--------|------|-------|-------|
| `GET` | `/healthz` | Gateway | Health check |
| `GET` | `/readyz` | Gateway | Readiness + auth mode summary |
| `GET` | `/gemini/v1beta/models` | Gemini-compatible | Model list |
| `POST` | `/gemini/v1beta/models/{model}:generateContent` | Gemini-compatible | Main Gemini-style route |
| `POST` | `/gemini/v1beta/models/{model}:streamGenerateContent` | Gemini-compatible | Streaming route |
| `GET` | `/openai/v1/models` | OpenAI-compatible | Minimal OpenAI model list |
| `POST` | `/openai/v1/chat/completions` | OpenAI-compatible | OpenAI Chat Completions compatibility route, supports both JSON and SSE |
| `POST` | `/openai/v1/responses` | OpenAI-compatible | Text-first Responses subset, supports JSON and semantic SSE |
| `POST` | `/vertex/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent` | Vertex-compatible | Canonical Vertex-style route |
| `POST` | `/vertex/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent` | Vertex-compatible | Canonical Vertex-style streaming |
| `POST` | `/vertex/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:predict` | Vertex-compatible | Vertex predict route |
| `POST` | `/api/session/validate` | Custom | Text smoke / session validation |
| `POST` | `/api/images/generate` | Custom | Frontend-friendly image generate |

---

Cloud Run note: for the current public and custom-domain deployment, use
`/readyz` as the primary smoke/readiness endpoint. `GET /healthz` remains
available in the gateway app for local/container-level checks, but it is not
the public verification path to rely on after Cloud Run cutover.

OpenAI SDK note: set `baseURL` to the `/openai/v1` prefix, for example
`https://gemini.monet.uno/openai/v1`. This gateway currently implements
`GET /models`, `POST /chat/completions`, and `POST /responses` on that prefix.

For `POST /openai/v1/chat/completions`:

- Default behavior returns a normal JSON `chat.completion` response.
- `stream: true` returns `text/event-stream` with OpenAI-style
  `chat.completion.chunk` frames and a final `data: [DONE]`.
- Phase 1 limits: only `n: 1` is accepted for streaming, and streaming tool
  calls are rejected with a pre-header `400 VALIDATION_FAILED`.
- If the configured GenAI client does not expose upstream streaming, the
  gateway returns `501 NOT_IMPLEMENTED`.

For `POST /openai/v1/responses`:

- Supported input subset:
  - `input` as a string
  - `input` as a message array with `type: "message"` items
  - `instructions`
  - `temperature`, `top_p`, `max_output_tokens`
  - custom function `tools` for non-streaming requests
- Supported `tool_choice` subset for non-streaming requests:
  - `auto`
  - `none`
  - `required`
  - `{ "type": "function", "name": "<tool-name>" }`
- `stream: true` returns semantic Responses SSE events such as
  `response.created`, `response.output_text.delta`, and `response.completed`.
- Current Phase 2 limits:
  - streaming is text-first only
  - streaming tool calls are rejected
  - `parallel_tool_calls: true` is rejected
  - persistence/state fields such as `background`, `conversation`, `store`,
    and `previous_response_id` are rejected
  - built-in/hosted tools are rejected

For native Gemini/Vertex streaming routes:

- The gateway returns SSE `data: <json>` frames and closes on EOF.
- It does **not** append `data: [DONE]` on native Gemini/Vertex streams.
- This shape is deliberate so the official `@google/genai` stream parser can
  consume the response through a custom base URL.

---

## Available Models

Kết quả dưới đây là smoke đã pass qua gateway với `GOOGLE_VERTEX_LOCATION=global`.

### Text / Multimodal

| Model ID | Status | Notes |
|----------|--------|-------|
| `gemini-3.5-flash` | ✅ OK | Mặc định nên dùng cho text |
| `gemini-3.1-pro-preview` | ✅ OK | Pass qua gateway |
| `gemini-3-flash-preview` | ✅ OK | Pass qua gateway |
| `gemini-3.1-flash-lite` | ✅ OK | Pass qua gateway |
| `gemini-2.5-flash` | ✅ OK | Pass qua gateway |
| `gemini-2.5-pro` | ✅ OK | Pass qua gateway |

### Image

| Model ID | Status | Notes |
|----------|--------|-------|
| `gemini-3.1-flash-image` | ✅ OK | Mặc định nên dùng cho image edit/generate |
| `gemini-3-pro-image` | ✅ OK | Pass qua gateway |
| `gemini-2.5-flash-image` | ✅ OK | Pass qua gateway |

### Failed In Smoke

| Model ID | Result | Notes |
|----------|--------|-------|
| `gemini-3-flash` | ❌ Fail | `404 NOT_FOUND` |
| `gemini-3.1-pro` | ❌ Fail | `404 NOT_FOUND` |
| `imagen-4.0-fast-generate-001` | ❌ Fail | Không còn hỗ trợ/không truy cập được |

---

## Usage Examples

### 1. Health Check

```bash
curl -X GET http://localhost:19089/healthz
```

Expected:

```json
{ "ok": true }
```

Cloud Run/public smoke should use:

```bash
curl -X GET https://YOUR_CLOUD_RUN_URL/readyz
```

### 2. Gemini-Compatible `generateContent`

```bash
curl -X POST http://localhost:19089/gemini/v1beta/models/gemini-3.5-flash:generateContent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <gateway-api-key>" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Reply with exactly: ok"
      }]
    }]
  }'
```

### 2b. Gemini SDK `streamGenerateContent`

```ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GATEWAY_API_KEY,
  httpOptions: {
    baseUrl: 'https://gemini.monet.uno/gemini',
    apiVersion: 'v1beta',
  },
});

const stream = await ai.models.generateContentStream({
  model: 'gemini-2.5-flash',
  contents: 'Reply with exactly: ok',
});

for await (const chunk of stream) {
  console.log(chunk.text);
}
```

### 3. OpenAI-Compatible `chat.completions` (JSON)

```bash
curl -X POST http://localhost:19089/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <gateway-api-key>" \
  -d '{
    "model": "gemini-3.5-flash",
    "messages": [
      { "role": "system", "content": "You are concise." },
      { "role": "user", "content": "Reply with exactly: ok" }
    ]
  }'
```

### 4. OpenAI-Compatible `chat.completions` (SSE)

```bash
curl -N -X POST http://localhost:19089/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <gateway-api-key>" \
  -d '{
    "model": "gemini-3.5-flash",
    "stream": true,
    "messages": [
      { "role": "user", "content": "Reply with exactly: ok" }
    ]
  }'
```

Expected stream shape:

```text
data: {"id":"chatcmpl_...","object":"chat.completion.chunk","created":...,"model":"gemini-3.5-flash","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl_...","object":"chat.completion.chunk","created":...,"model":"gemini-3.5-flash","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":null}]}

data: {"id":"chatcmpl_...","object":"chat.completion.chunk","created":...,"model":"gemini-3.5-flash","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### 5. Custom Text Validation Route

```bash
curl -X POST http://localhost:19089/api/session/validate \
  -H "Content-Type: application/json" \
  -H "x-api-key: <gateway-api-key>" \
  -d '{
    "model": "gemini-2.5-flash",
    "prompt": "Reply with exactly: ok"
  }'
```

### 6. Custom Image Generate Route

```bash
curl -X POST http://localhost:19089/api/images/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: <gateway-api-key>" \
  -d '{
    "model": "gemini-3.1-flash-image",
    "prompt": "studio fashion portrait, clean white background",
    "aspectRatio": "1:1",
    "numberOfImages": 1
  }'
```

Expected response shape:

```json
{
  "success": true,
  "images": [
    {
      "mimeType": "image/png",
      "base64Data": "..."
    }
  ]
}
```

### 7. OpenAI-Compatible `responses` (JSON)

```bash
curl -X POST http://localhost:19089/openai/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <gateway-api-key>" \
  -d '{
    "model": "gemini-3.5-flash",
    "input": "Reply with exactly: ok"
  }'
```

OpenAI SDK example:

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY,
  baseURL: 'https://YOUR_CLOUD_RUN_URL/openai/v1',
});

const response = await client.responses.create({
  model: 'gemini-3.5-flash',
  input: 'Reply with exactly: ok',
});
```

### 8. OpenAI-Compatible `responses` (SSE)

```bash
curl -N -X POST http://localhost:19089/openai/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <gateway-api-key>" \
  -d '{
    "model": "gemini-3.5-flash",
    "input": "Reply with exactly: ok",
    "stream": true
  }'
```

OpenAI SDK example:

```ts
const stream = await client.responses.create({
  model: 'gemini-3.5-flash',
  input: 'Reply with exactly: ok',
  stream: true,
});

for await (const event of stream) {
  console.log(event.type);
}
```

---

## Integration Notes

- Dùng `global` làm `GOOGLE_VERTEX_LOCATION` nếu project/account hiện tại bị giới hạn alias ở `us-central1`.
- Với `docker compose`, gateway local mặc định publish ở `http://localhost:19089`.
- Cloud Run production hiện tại của repo này:
  - Frontend: `https://changstore.vercel.app`
  - Gateway base URL: `https://chang-store-vertex-gateway-eeqmzij23a-as.a.run.app/gemini`
  - Gateway readiness URL: `https://chang-store-vertex-gateway-eeqmzij23a-as.a.run.app/readyz`
- `docker-compose.yml` mount sẵn thư mục `/media/monet/SSD Web/CodeBase` vào `/run/vertex-accounts`, nên đổi service account chỉ cần sửa `GOOGLE_APPLICATION_CREDENTIALS` trong `gateway/.env`.
- Gateway này khác `cliproxy`: model dòng `3.0/3.1` không cần ép sang hậu tố `-preview` nếu smoke matrix đã pass với alias hiện tại.
- Mặc định hiện tại phù hợp với app:
  - Text: `gemini-3.5-flash`
  - Image edit/generate: `gemini-3.1-flash-image`
- Không dùng `imagen-4.0*` trong app hoặc gateway flow mới.
- Không đưa service account JSON vào Vite env, localStorage, hoặc request từ browser.
- Production wildcard CORS mặc định nên để **tắt** (`GATEWAY_ALLOW_WILDCARD_CORS=false`).
- Stream production controls hiện có trong gateway config:
  - `GATEWAY_STREAM_MAX_DURATION_MS`
  - `GATEWAY_STREAM_IDLE_TIMEOUT_MS`
  - `GATEWAY_STREAM_PER_KEY_LIMIT`
  - `GATEWAY_STREAM_QUEUE_LIMIT`
