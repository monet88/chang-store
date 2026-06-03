# Cloud Run Deployment

Thư mục này chứa artifact deploy gateway lên Google Cloud Run mà không sửa code
runtime chung. Flow local bằng Docker Compose trong repo root vẫn giữ nguyên.

## Mục tiêu

- Giữ nguyên gateway local/dev hiện tại.
- Không đổi logic đọc `GOOGLE_APPLICATION_CREDENTIALS` từ file.
- Trên Cloud Run, mount service account JSON từ Secret Manager thành file trong
  container để gateway đọc đúng path cũ.

## Kiến trúc đề xuất

1. Build image từ `gateway/Dockerfile`
2. Push lên Artifact Registry
3. Tạo Secret Manager secret chứa nguyên file service account JSON
4. Deploy Cloud Run
5. Mount secret vào container tại `/run/secrets/vertex-account.json`
6. Set `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/vertex-account.json`

## File trong thư mục này

- `bootstrap-cloud-run.sh`: preflight + bootstrap project resources cho Cloud Run
- `cloudbuild-gateway.yaml`: Cloud Build config để build `gateway/Dockerfile` với repo root context
- `deploy-cloud-run.sh`: script deploy Cloud Run
- `cloud-run.env.yaml.example`: file env mẫu cho `gcloud run deploy`
- `cloud-run-rollout-plan.md`: rollout plan bám theo project `gcloud` hiện tại

## Prerequisites

- Đã bật billing/free credits trên Google Cloud project
- Đã cài `gcloud`
- Đã login:

```bash
gcloud auth login
gcloud auth application-default login
```

- Đã chọn project:

```bash
gcloud config set project YOUR_PROJECT_ID
```

- Đã bật API:

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com
```

## 1. Tạo Artifact Registry repo

```bash
gcloud artifacts repositories create chang-store \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="Chang Store gateway images"
```

## 2. Tạo secret từ file account JSON

Ví dụ file local của bạn là:

```text
/media/monet/SSD Web/CodeBase/vertex-account-2.json
```

Tạo secret:

```bash
gcloud secrets create chang-store-vertex-account \
  --data-file="/media/monet/SSD Web/CodeBase/vertex-account-2.json"
```

Nếu secret đã tồn tại và bạn muốn cập nhật version mới:

```bash
gcloud secrets versions add chang-store-vertex-account \
  --data-file="/media/monet/SSD Web/CodeBase/vertex-account-2.json"
```

## 3. Chuẩn bị env file

Copy file mẫu:

```bash
cp gcp/cloud-run.env.yaml.example gcp/cloud-run.env.yaml
```

Sửa các giá trị cần thiết:

- `GATEWAY_API_KEYS`
- `GATEWAY_CORS_ORIGINS`
- `GOOGLE_VERTEX_PROJECT`
- `GOOGLE_VERTEX_LOCATION`
- `GOOGLE_APPLICATION_CREDENTIALS`

Không thêm `PORT` vào file env cho Cloud Run vì đây là biến reserved do nền tảng tự inject.

## 4. Deploy Cloud Run

Khuyến nghị:

```bash
bash gcp/bootstrap-cloud-run.sh
```

Sau đó mới deploy:

```bash
bash gcp/deploy-cloud-run.sh
```

Script mặc định:

- build image bằng `gcloud builds submit`
- push lên Artifact Registry
- deploy service `chang-store-vertex-gateway`
- chạy service bằng runtime service account riêng
- mount secret vào `/run/secrets/vertex-account.json`
- expose public endpoint

## 5. Biến môi trường script

Bạn có thể override trước khi chạy script:

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="asia-southeast1"
export GCP_AR_REPO="chang-store"
export GCP_SERVICE_NAME="chang-store-vertex-gateway"
export GCP_RUNTIME_SA_NAME="chang-store-vertex-gateway"
export GCP_SECRET_NAME="chang-store-vertex-account"
export GCP_SECRET_VERSION="latest"
export GCP_ENV_FILE="gcp/cloud-run.env.yaml"

bash gcp/deploy-cloud-run.sh
```

## 6. Domain riêng

Deploy xong, lấy URL service:

```bash
gcloud run services describe chang-store-vertex-gateway \
  --region=asia-southeast1 \
  --format='value(status.url)'
```

Nếu bạn muốn gắn domain:

- đơn giản nhất: giữ domain ở Cloudflare và reverse proxy vào Cloud Run URL
- hoặc dùng Google Load Balancer phía trước Cloud Run cho production

App sẽ trỏ vào:

```text
https://gateway.yourdomain.com/gemini
```

Với deployment hiện tại của repo này, app Vercel có thể trỏ thẳng vào:

```text
https://chang-store-vertex-gateway-eeqmzij23a-as.a.run.app/gemini
```

Frontend production hiện tại:

```text
https://changstore.vercel.app
```

Nếu Vite local tự nhảy sang cổng khác vì `3000` đang bận, nhớ thêm origin local thực tế
vào `GATEWAY_CORS_ORIGINS` rồi redeploy Cloud Run. Hiện template đã include cả
`3000` và `3001`.

## 7. Smoke test

Readiness:

```bash
curl -X GET "https://YOUR_CLOUD_RUN_URL/readyz"
```

Lưu ý: với Cloud Run public/custom domain hiện tại, dùng `/readyz` làm endpoint
smoke/health chính. `GET /healthz` vẫn tồn tại trong app nhưng không phải là
đường public đáng tin cậy để xác nhận service đã sẵn sàng sau domain cutover.

Gemini route:

```bash
curl -X POST "https://YOUR_CLOUD_RUN_URL/gemini/v1beta/models/gemini-3.5-flash:generateContent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GATEWAY_API_KEY" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Reply with exactly: ok"
      }]
    }]
  }'
```

OpenAI-compatible route:

```bash
curl -X POST "https://YOUR_CLOUD_RUN_URL/openai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GATEWAY_API_KEY" \
  -d '{
    "model": "gemini-3.5-flash",
    "messages": [
      { "role": "system", "content": "You are concise." },
      { "role": "user", "content": "Reply with exactly: ok" }
    ]
  }'
```

Nếu dùng OpenAI SDK, đặt `baseURL` là:

```text
https://YOUR_CLOUD_RUN_URL/openai/v1
```

Hiện gateway mới support `GET /models` và `POST /chat/completions` trên prefix
OpenAI-compatible; `responses` chưa được implement.

## Ghi chú vận hành

- Giữ `GOOGLE_VERTEX_LOCATION=global` cho matrix model hiện tại.
- Cloud Run production nên dùng API key riêng, không dùng `monet-4292`.
- Nếu app web của bạn chỉ chạy ở một vài domain, giới hạn chặt `GATEWAY_CORS_ORIGINS`.
- Vì flow này không sửa code, gateway vẫn đọc file credentials như local; khác ở chỗ file đó được Secret Manager mount vào runtime.
