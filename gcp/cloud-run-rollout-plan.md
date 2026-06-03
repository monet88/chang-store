# Cloud Run Rollout Plan

> Generated from the current repo state and active `gcloud` context on 2026-06-03.

## Active Context

- Project: `project-b82b6a5a-13c8-42e4-a56`
- Active `gcloud` account: `ais-gemini-key-867d56aa8d174f7@553071258057.iam.gserviceaccount.com`
- Recommended region: `asia-southeast1`
- Gateway runtime model defaults already aligned in repo:
  - text: `gemini-3.5-flash`
  - image edit/generate/upscale: `gemini-3.1-flash-image`

## Current GCP Gaps

These were observed from the current CLI context:

1. `run.googleapis.com` is not enabled on the project.
2. Artifact Registry is not ready for use yet from the current project context.
3. The active `gcloud` account is a service account, not a human user account.

This means the correct next move is **bootstrap first, deploy second**.

## Deployment Strategy

Keep the current split:

- local/personal machine: Docker Compose + `gateway/.env`
- Google Cloud: Cloud Run + Secret Manager-mounted credentials file

Do **not** change gateway runtime code for Cloud Run. Instead:

- keep `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/vertex-account.json`
- mount the JSON from Secret Manager at deploy time
- run the Cloud Run service with a dedicated runtime service account

## Phase 1 — Bootstrap the Project

Run:

```bash
cp gcp/cloud-run.env.yaml.example gcp/cloud-run.env.yaml
```

Then bootstrap the project:

```bash
export GCP_PROJECT_ID="project-b82b6a5a-13c8-42e4-a56"
export GCP_REGION="asia-southeast1"
export GCP_AR_REPO="chang-store"
export GCP_RUNTIME_SA_NAME="chang-store-vertex-gateway"
export GCP_SECRET_NAME="chang-store-vertex-account"
export GCP_ACCOUNT_JSON_PATH="/media/monet/SSD Web/CodeBase/vertex-account-2.json"

bash gcp/bootstrap-cloud-run.sh
```

Expected outcomes:

- required APIs enabled
- Artifact Registry repository exists
- runtime service account exists
- secret exists and contains the latest account JSON
- runtime service account can access Secret Manager and call Vertex AI

## Phase 2 — Prepare Runtime Config

Edit:

- `gcp/cloud-run.env.yaml`

Required values:

- `GATEWAY_API_KEYS`: replace `monet-4292`
- `GATEWAY_CORS_ORIGINS`: production frontend domain(s)
- `GOOGLE_VERTEX_PROJECT`: `project-b82b6a5a-13c8-42e4-a56`
- `GOOGLE_VERTEX_LOCATION`: `global`
- `GOOGLE_APPLICATION_CREDENTIALS`: `/run/secrets/vertex-account.json`
- include production frontend origin in `GATEWAY_CORS_ORIGINS`

Do not set `PORT` in this file. Cloud Run injects it automatically and rejects reserved env names.

Current production frontend:

```text
https://changstore.vercel.app
```

Current deployed gateway base URL:

```text
https://chang-store-vertex-gateway-eeqmzij23a-as.a.run.app/gemini
```

## Phase 3 — Deploy Cloud Run

Deploy with:

```bash
export GCP_PROJECT_ID="project-b82b6a5a-13c8-42e4-a56"
export GCP_REGION="asia-southeast1"
export GCP_AR_REPO="chang-store"
export GCP_SERVICE_NAME="chang-store-vertex-gateway"
export GCP_SECRET_NAME="chang-store-vertex-account"
export GCP_SECRET_VERSION="latest"
export GCP_ENV_FILE="gcp/cloud-run.env.yaml"

bash gcp/deploy-cloud-run.sh
```

## Phase 4 — Validate the Service

1. Readiness:

```bash
curl -X GET "https://YOUR_CLOUD_RUN_URL/readyz"
```

Use `/readyz` as the authoritative public smoke endpoint for the current Cloud
Run and custom-domain setup. `/healthz` still exists in the gateway app, but it
is not a reliable public verification path after cutover.

2. Text smoke:

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

3. Image smoke:

```bash
curl -X POST "https://YOUR_CLOUD_RUN_URL/api/images/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GATEWAY_API_KEY" \
  -d '{
    "model": "gemini-3.1-flash-image",
    "prompt": "studio fashion portrait, clean white background",
    "aspectRatio": "1:1",
    "numberOfImages": 1
  }'
```

## Phase 5 — Domain Cutover

Recommended order:

1. Keep the default Cloud Run URL for first validation.
2. Put Cloudflare or Google Load Balancer in front after smoke passes.
3. Only then point the app setting:

```text
https://your-domain.com/gemini
```

## Operational Notes

- Current repo already routes browser image requests to gateway-native endpoints:
  - `/api/images/generate`
  - `/api/images/edit`
  - `/api/images/upscale`
- Current repo already defaults to the tested gateway-safe models.
- `PatternGenerator` already requires at least one reference image and should stay that way.
- If Cloud Run latency becomes an issue, tune these first before changing architecture:
  - `GATEWAY_UPSTREAM_TIMEOUT_MS`
  - `GATEWAY_UPSTREAM_CONCURRENCY`
  - Cloud Run timeout / max instances
