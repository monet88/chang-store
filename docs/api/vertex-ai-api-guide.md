# Hướng Dẫn Sử Dụng Vertex AI API & Xác Thực Bằng Service Account JSON

Tài liệu này hướng dẫn cách kết nối, xác thực và gọi các mô hình AI (Gemini & Imagen) trên nền tảng **Google Cloud Vertex AI** sử dụng tài khoản dịch vụ (Service Account JSON) và thiết lập môi trường bằng gcloud CLI cho dự án Chang Store.

## 1. Mức Độ Hỗ Trợ Mô Hình (Model Support & Naming)

Khi sử dụng Vertex AI, cấu trúc định danh của các mô hình chính thức (1P Models) không có hậu tố `-preview` như trên Google AI Studio. 

### Mô hình Tạo & Sửa ảnh (Image Generation & Editing)
| Loại | Tên mô hình (API Studio) | Model ID chuẩn trên Vertex AI | Khả năng (Capabilities) |
| :--- | :--- | :--- | :--- |
| **Gemini 3.1 Flash Image** | `gemini-3.1-flash-image-preview` | `gemini-3.1-flash-image` | Tạo ảnh, Sửa ảnh, Upscale, Hỗ trợ tỉ lệ màn hình & Kích thước |
| **Gemini 3 Pro Image** | `gemini-3-pro-image-preview` | `gemini-3-pro-image` | Chỉnh sửa ảnh nâng cao |
| **Gemini 2.5 Flash Image** | `gemini-2.5-flash-image` | `gemini-2.5-flash-image` | Chỉnh sửa ảnh ổn định phiên bản 2.5 |
| **Imagen 3.0 Standard** | - | `imagen-3.0-generate-002` | Sinh ảnh nghệ thuật từ văn bản (tối ưu nhất) |
| **Imagen 4.0 Standard** | - | `imagen-4.0-generate-001` | Sinh ảnh thế hệ mới |

### Mô hình Xử lý Văn bản & Logic (Text Generation)
| Tên mô hình (API Studio) | Model ID chuẩn trên Vertex AI | Ngày ngưng hoạt động (GCP) |
| :--- | :--- | :--- |
| `gemini-3.1-flash-lite-preview` | `gemini-3.1-flash-lite` | Chưa công bố |
| `gemini-3-flash-preview` | `gemini-3.0-flash` (hoặc dùng `gemini-3.1-flash-lite`) | Đã đóng bản cũ từ 01/06/2026 |
| `gemini-2.5-pro` | `gemini-2.5-pro` | Không trước 16/10/2026 |
| `gemini-2.5-flash` | `gemini-2.5-flash` | Không trước 16/10/2026 |

### Danh sách các mô hình hoạt động thực tế qua Proxy (Đã kiểm tra ngày 02/06/2026)

Dưới đây là danh sách các model ID được kiểm tra thành công qua Proxy (`https://cliproxy.monet.uno/` với API Key `monet-4292`):

#### Mô hình Văn bản & Logic (Text generation)
- `gemini-3.1-pro`: **Hoạt động tốt** (Tự động ánh xạ sang `gemini-3.1-pro-preview` ở location `global` trên Vertex AI).
- `gemini-3.1-flash-lite-preview`: **Hoạt động tốt** (Tự động ánh xạ sang `gemini-3.1-flash-lite` ở location `global` trên Vertex AI).
- `gemini-3.5-flash`: **Hoạt động tốt** (Chạy trực tiếp).
- `gemini-2.5-flash`: **Hoạt động tốt** (Chạy trực tiếp).
- `gemini-2.5-flash-lite`: **Hoạt động tốt** (Chạy trực tiếp).
- `gemini-2.5-pro`: **Hoạt động tốt** (Chạy trực tiếp).

*Lưu ý:* Tránh gọi trực tiếp `gemini-3.1-pro-preview` vì proxy sẽ không định tuyến được (báo lỗi `unknown provider`). Hãy gọi thông qua tên `gemini-3.1-pro`.

#### Mô hình Hình ảnh (Image Generation/Editing - Gọi qua Native Endpoint `/v1beta`)
- `gemini-3.1-flash-image-preview`: **Hoạt động tốt** (Tự động ánh xạ sang `gemini-3.1-flash-image` trên Vertex AI).
- `gemini-3-pro-image-preview`: **Hoạt động tốt** (Tự động ánh xạ sang `gemini-3-pro-image` trên Vertex AI).
- `gemini-2.5-flash-image`: **Hoạt động tốt** (Chạy trực tiếp).

---

## 2. Xác Thực Bằng Service Account JSON

Tài khoản dịch vụ (Service Account Key JSON) được cấu hình để đại diện cho một danh tính lập trình có quyền gọi API Google Cloud.

### A. Cách hoạt động của Luồng Xác Thực (OAuth2 Token Exchange)
Mô hình SDK của Google hoặc mã nguồn tự viết sẽ ký mã thông báo JWT (JSON Web Token) bằng khóa riêng tư (`private_key`) chứa trong tệp JSON, sau đó gửi yêu cầu đổi lấy mã truy cập tạm thời (Access Token) từ API của Google.

Ví dụ mã nguồn tạo Access Token bằng Node.js thuần (không phụ thuộc thư viện ngoài):
```javascript
const fs = require('fs');
const crypto = require('crypto');

function base64url(stringOrBuffer) {
  const base64 = Buffer.isBuffer(stringOrBuffer)
    ? stringOrBuffer.toString('base64')
    : Buffer.from(stringOrBuffer).toString('base64');
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(credentialsPath) {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  const signature = signer.sign(credentials.private_key);
  const encodedSignature = base64url(signature);
  const jwt = `${unsignedJwt}.${encodedSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  return data.access_token; // Hạn dùng 3600 giây (1 giờ)
}
```

### B. Thiết Lập Môi Trường Local (gcloud CLI & ADC)
Để cấu hình khóa trên máy tính lập trình để gcloud CLI và mã nguồn tự nhận diện:

1. **Đặt biến môi trường Application Default Credentials (ADC):**
   Thêm dòng sau vào tệp cấu hình Shell (ví dụ: `~/.bashrc`):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/đường-dẫn-đến/tệp-khóa-tài-khoản-dịch-vụ.json"
   ```
   *Sau đó chạy lệnh `source ~/.bashrc` để áp dụng.*

2. **Kích hoạt tài khoản dịch vụ trên gcloud CLI:**
   ```bash
   gcloud auth activate-service-account --key-file="/đường-dẫn-đến/tệp-khóa-tài-khoản-dịch-vụ.json"
   gcloud config set project [PROJECT_ID_CỦA_BẠN]
   ```

3. **Kiểm tra trạng thái:**
   ```bash
   gcloud auth list
   # Sẽ hiển thị danh sách tài khoản, tài khoản dịch vụ có dấu * (Active)
   ```

---

## 3. Cấu Trúc Lệnh Gọi API REST (REST API Contract)

Dưới đây là cấu trúc định dạng JSON payload khi thực hiện gọi trực tiếp đến API Vertex AI.

### A. Sinh ảnh bằng Gemini 3.1 Flash Image (Định dạng generateContent)
* **Phương thức:** `POST`
* **Endpoint:** `https://us-central1-aiplatform.googleapis.com/v1/projects/[PROJECT_ID]/locations/us-central1/publishers/google/models/gemini-3.1-flash-image:generateContent`
* **Headers:**
  * `Content-Type: application/json`
  * `Authorization: Bearer [OAUTH2_ACCESS_TOKEN]`
* **Request Body:**
  ```json
  {
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "A seamless tileable vintage textile pattern with gold roses, solid black background, flat 2D"
          }
        ]
      }
    ],
    "generationConfig": {
      "responseModalities": ["IMAGE"]
    }
  }
  ```
* **Response Body (Success):**
  ```json
  {
    "candidates": [
      {
        "content": {
          "parts": [
            {
              "inlineData": {
                "mimeType": "image/png",
                "data": "[DỮ_LIỆU_ẢNH_BASE64_SIÊU_DÀI]"
              }
            }
          ],
          "role": "model"
        },
        "finishReason": "STOP",
        "avgLogprobs": -0.05
      }
    ],
    "usageMetadata": {
      "promptTokenCount": 18,
      "candidatesTokenCount": 1120,
      "totalTokenCount": 1138
    }
  }
  ```

### B. Sinh ảnh bằng Imagen 3.0 (Định dạng predict)
* **Phương thức:** `POST`
* **Endpoint:** `https://us-central1-aiplatform.googleapis.com/v1/projects/[PROJECT_ID]/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict`
* **Headers:**
  * `Content-Type: application/json`
  * `Authorization: Bearer [OAUTH2_ACCESS_TOKEN]`
* **Request Body:**
  ```json
  {
    "instances": [
      {
        "prompt": "A red apple on a table, 2D vector style"
      }
    ],
    "parameters": {
      "sampleCount": 1,
      "aspectRatio": "1:1",
      "outputMimeType": "image/png"
    }
  }
  ```
* **Response Body (Success):**
  ```json
  {
    "predictions": [
      {
        "bytesBase64Encoded": "[DỮ_LIỆU_ẢNH_BASE64_SIÊU_DÀI]",
        "mimeType": "image/png"
      }
    ]
  }
  ```
