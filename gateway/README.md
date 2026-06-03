# Chang Store Vertex Gateway

Node 22 Cloud Run gateway for Gemini-compatible routing and frontend-friendly image endpoints.

## Local Run

```bash
GATEWAY_API_KEYS=local-dev-key \
GATEWAY_CORS_ORIGINS=http://localhost:3000 \
GOOGLE_APPLICATION_CREDENTIALS="/media/monet/SSD Web/CodeBase/vertex-account.json" \
GOOGLE_VERTEX_PROJECT="<project-id>" \
GOOGLE_VERTEX_LOCATION=us-central1 \
npm --prefix gateway run dev
```

The credentials file must be a Google service account key JSON with top-level
`type: "service_account"`, `project_id`, `client_email`, and `private_key`.
OAuth client JSON files with top-level `installed` or `web` are rejected because
they do not contain the signing material required for server-side Vertex AI auth.

Use `/gemini/v1beta/...` as the compatibility base URL suffix for the SPA.

## Docker Compose

`docker-compose.yml` ở root repo hiện:

- `./gateway/config.yaml` vào `/app/config.yaml`
- load biến môi trường runtime từ `./gateway/.env`
- mount read-only thư mục `/media/monet/SSD Web/CodeBase` vào `/run/vertex-accounts`

Gateway sẽ đọc file này khi có:

```bash
GATEWAY_CONFIG_FILE=/app/config.yaml
```

và service account đang được chọn bởi:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/run/vertex-accounts/vertex-account-2.json
```

Chạy:

```bash
docker compose up -d --build
```

Mặc định compose map gateway ra host port `19089`.
Muốn đổi cổng host:

```bash
GATEWAY_HOST_PORT=19123 docker compose up -d --build
```

App cấu hình:

- Proxy URL: `http://localhost:19089/gemini`
- Proxy API Key: `monet-4292`

## Đổi Service Account

Nếu bạn đổi sang file account JSON khác nhưng vẫn nằm trong:

```text
/media/monet/SSD Web/CodeBase
```

thì chỉ cần sửa `GOOGLE_APPLICATION_CREDENTIALS` trong `gateway/.env`, ví dụ:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/run/vertex-accounts/vertex-account-prod.json
```

rồi chạy lại:

```bash
docker compose up -d --build
```

Nếu có nhiều account JSON, giữ chúng trong cùng thư mục host đó và trỏ `GOOGLE_APPLICATION_CREDENTIALS` tới file bạn muốn dùng. Gateway hiện chỉ dùng một service account tại một thời điểm, nhưng không cần sửa lại `docker-compose.yml` mỗi lần đổi file.

## Config Settings

`gateway/config.yaml` hiện hỗ trợ chỉnh trực tiếp các nhóm setting sau:

- `port`: cổng server trong container.
- `gatewayKeys`: danh sách API key mà gateway chấp nhận.
- `corsOrigins`: danh sách origin được phép gọi từ browser. Mặc định local nên gồm cả `http://localhost:3000` và `http://127.0.0.1:3000`.
- `googleProject`: GCP project ID cho Vertex.
- `googleCredentialsFile`: đường dẫn file service account trong container. Nếu `GOOGLE_APPLICATION_CREDENTIALS` có giá trị thì env sẽ override field này.
- `googleLocation`: nên dùng `global` cho account/project hiện tại.
- `googleApiVersion`: mặc định `v1`.
- `maxJsonBytes`: giới hạn body JSON.
- `maxImages`: số ảnh tối đa cho một request.
- `maxDecodedImageBytes`: giới hạn tổng bytes ảnh decode.
- `upstreamTimeoutMs`: timeout gọi Vertex upstream.
- `upstreamConcurrency`: số request upstream đồng thời.
- `enableGeminiRoutes`: bật/tắt `/gemini/*`.
- `enableVertexRoutes`: bật/tắt `/vertex/*`.
- `enableVtxRoutes`: bật/tắt `/vtx/*`.
- `enableImageRoutes`: bật/tắt `/api/images/*`.

Quy tắc ưu tiên:

- `config.yaml` là base config cho Docker Compose.
- Biến môi trường vẫn override được nếu bạn cần ép khác ở runtime.
