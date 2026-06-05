# Vertex AI TTS And Embedding Guide

> Tested: 2026-06-05
> Auth mode: service account JSON
> Tested account file: `gateway/accounts/active.json`

---

## Purpose

Guide này áp dụng cho việc gọi Vertex AI trực tiếp bằng Google Gen AI SDK ở
phía server bằng service account JSON.

Guide này **không** có nghĩa là gateway hiện đã expose sẵn endpoint TTS hoặc
embedding cho client app. Hiện tại repo mới verify được:

- embedding gọi trực tiếp bằng SDK là dùng được
- TTS gọi trực tiếp bằng SDK là dùng được
- live native audio chưa có proof pass

Mức xác nhận trong guide này:

- `runtime-pass`: đã gọi thật bằng service account JSON và có response hợp lệ
- `catalog-visible`: account nhìn thấy model trong Model Garden catalog
- `runtime-failed`: đã gọi thật nhưng fail với shape/location đang test

---

## What Was Verified

### Embedding

Model đã test pass:

- `gemini-embedding-001`

Kết quả runtime:

- gọi được bằng `ai.models.embedContent(...)`
- trả về vector size `3072`

### Text To Speech

Models đã test pass:

- `gemini-2.5-flash-tts`
- `gemini-2.5-flash-preview-tts`

Ngôn ngữ đã test pass:

- `vi-VN`

Câu mẫu đã test:

```text
Xin chào, tôi là Thắng, tôi ở Việt Nam, sống tại Hồ Chí Minh
```

Voice đã test pass:

- `Aoede`

Định dạng audio runtime nhận về:

- `audio/L16;codec=pcm;rate=24000`

### Live / Native Audio

Đã test fail ở runtime:

- `gemini-live-2.5-flash-native-audio`

Kết quả:

- `live.connect(...)` mở được session
- khi gửi turn thật, server đóng với `code 1008`
- chưa có proof pass cho live/native audio với account này

---

## Account Model Matrix

Danh sách dưới đây là các model Gemini mà `active.json` nhìn thấy được trong
catalog tại thời điểm test, cộng với trạng thái proof hiện có.

| Model | Type | Proof | Notes |
|---|---|---|---|
| `gemini-embedding-001` | embedding | `runtime-pass` | `embedContent(...)` pass, vector size `3072` |
| `gemini-embedding-2` | embedding | `catalog-visible` | Chưa bắn runtime trong repo này |
| `gemini-2.5-pro` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |
| `gemini-2.5-flash` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |
| `gemini-2.5-flash-lite` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |
| `gemini-2.5-computer-use-preview-10-2025` | computer-use | `catalog-visible` | Chưa có route/giao thức test riêng trong repo này |
| `gemini-2.5-flash-preview-09-2025` | text/multimodal | `catalog-visible` | Catalog thấy được, chưa bắn runtime ở guide này |
| `gemini-2.5-flash-lite-preview-09-2025` | text/multimodal | `catalog-visible` | Catalog thấy được, chưa bắn runtime ở guide này |
| `gemini-2.5-flash-image` | image | `catalog-visible` | Có xuất hiện trong gateway image surface, nhưng guide này không test trực tiếp |
| `gemini-2.5-pro-tts` | TTS | `catalog-visible` | Catalog thấy được, chưa bắn runtime trong guide này |
| `gemini-2.5-flash-tts` | TTS | `runtime-pass` | Pass với `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` |
| `gemini-3-pro-preview` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |
| `gemini-3-pro-image-preview` | image | `catalog-visible` | Catalog thấy được, chưa bắn runtime ở guide này |
| `gemini-live-2.5-flash-native-audio` | live/native audio | `runtime-failed` | Session connect được nhưng turn thật bị close `1008` |
| `gemini-3-flash-preview` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |
| `gemini-3.1-flash-lite-preview` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |
| `gemini-3.1-flash-image-preview` | image | `catalog-visible` | Catalog thấy được, chưa bắn runtime ở guide này |
| `gemini-3.1-pro-preview` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |
| `gemini-3.5-flash` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |
| `gemini-3.1-flash-tts-preview` | TTS | `catalog-visible` | Chưa bắn runtime trong guide này |
| `gemini-3.1-flash-image` | image | `catalog-visible` | Có xuất hiện trong gateway image surface, nhưng guide này không test trực tiếp |
| `gemini-3-pro-image` | image | `catalog-visible` | Có xuất hiện trong gateway image surface, nhưng guide này không test trực tiếp |
| `gemini-3.1-flash-lite` | text/multimodal | `catalog-visible` | Chưa có proof direct SDK trong guide này |

Lưu ý về tên model TTS:

- Catalog `gcloud` cho account này trả `gemini-2.5-flash-tts`
- Runtime SDK hiện test pass với:
  - `gemini-2.5-flash-tts`
  - `gemini-2.5-flash-preview-tts`
- Hai tên này không phải lúc nào cũng hiện giống hệt nhau giữa catalog và SDK,
  nên với TTS hãy ưu tiên runtime proof hơn là chỉ nhìn list catalog

---

## Important Limits

### Embedding

- Embedding không đi qua các route gateway hiện tại.
- Nếu bạn muốn dùng embedding qua `gateway/`, cần thêm route/server contract
  mới cho `embedContent`.
- Catalog thấy `gemini-embedding-2`, nhưng guide này mới runtime-verify
  `gemini-embedding-001`.

### TTS

- TTS không nên gọi trần với chỉ `responseModalities: ['AUDIO']`.
- Với model đã test, request thiếu `speechConfig.voiceConfig` sẽ trả:

```text
400 INVALID_ARGUMENT
```

- Cần gửi thêm `speechConfig` với prebuilt voice.
- Catalog thấy thêm `gemini-2.5-pro-tts` và `gemini-3.1-flash-tts-preview`,
  nhưng guide này mới runtime-verify `gemini-2.5-flash-tts` và
  `gemini-2.5-flash-preview-tts`.

---

## Authentication

Ví dụ khởi tạo SDK bằng service account JSON:

```ts
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';

const serviceAccount = JSON.parse(
  fs.readFileSync('gateway/accounts/active.json', 'utf8'),
);

const ai = new GoogleGenAI({
  vertexai: true,
  project: serviceAccount.project_id,
  location: 'global',
  apiVersion: 'v1',
  googleAuthOptions: {
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  },
});
```

Ghi nhớ:

- Dùng service account JSON ở phía server
- Không gửi private key xuống browser
- Catalog model nhìn thấy được không đủ để kết luận runtime pass, nhất là với
  TTS và live surfaces

---

## Embedding Example

Ví dụ tối thiểu:

```ts
const response = await ai.models.embedContent({
  model: 'gemini-embedding-001',
  contents: ['test embedding from service account'],
});

const vector = response.embeddings?.[0]?.values ?? [];
console.log(vector.length);
```

Khi test thật với `active.json`, vector length trả về là `3072`.

---

## Vietnamese TTS Example

Ví dụ tối thiểu đã pass:

```ts
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-tts',
  contents: 'Xin chào, tôi là Thắng, tôi ở Việt Nam, sống tại Hồ Chí Minh',
  config: {
    responseModalities: ['AUDIO'],
    speechConfig: {
      languageCode: 'vi-VN',
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Aoede',
        },
      },
    },
  },
});
```

Kiểm tra audio part:

```ts
const parts = response.candidates?.[0]?.content?.parts ?? [];
const audioPart = parts.find((part) =>
  part.inlineData?.mimeType?.startsWith?.('audio/'),
);

console.log(audioPart?.inlineData?.mimeType);
```

Kết quả test thực tế:

- `gemini-2.5-flash-tts` -> pass
- `gemini-2.5-flash-preview-tts` -> pass
- mime type -> `audio/L16;codec=pcm;rate=24000`

---

## Recommended Usage

### Nếu bạn chỉ cần embedding

- Dùng `ai.models.embedContent(...)` trực tiếp ở backend
- Bắt đầu với `gemini-embedding-001`
- Chỉ chuyển sang `gemini-embedding-2` sau khi bạn bắn runtime proof riêng

### Nếu bạn chỉ cần TTS tiếng Việt

- Dùng `gemini-2.5-flash-tts` làm mặc định ổn định trước
- Có thể thử `gemini-2.5-flash-preview-tts` nếu bạn muốn bám preview runtime
- Gửi đủ:
  - `responseModalities: ['AUDIO']`
  - `speechConfig.languageCode: 'vi-VN'`
  - `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`

### Nếu bạn muốn đưa TTS/embedding vào gateway

Cần thêm ít nhất:

- route mới cho embedding
- route mới cho TTS
- response contract rõ ràng cho audio bytes hoặc file output
- validation cho `speechConfig`, `languageCode`, `voiceName`

---

## Rule Of Thumb

- Embedding: dùng được trực tiếp bằng SDK nếu service account có quyền Vertex
  AI.
- TTS: dùng được, nhưng phải gửi đúng `speechConfig`.
- Live/native audio: không suy ra từ catalog; luôn phải test runtime riêng.
