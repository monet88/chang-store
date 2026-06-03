#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GCP_PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
GCP_REGION="${GCP_REGION:-asia-southeast1}"
GCP_AR_REPO="${GCP_AR_REPO:-chang-store}"
GCP_SERVICE_NAME="${GCP_SERVICE_NAME:-chang-store-vertex-gateway}"
GCP_SECRET_NAME="${GCP_SECRET_NAME:-chang-store-vertex-account}"
GCP_SECRET_VERSION="${GCP_SECRET_VERSION:-latest}"
GCP_ENV_FILE="${GCP_ENV_FILE:-gcp/cloud-run.env.yaml}"
GCP_RUNTIME_SA_NAME="${GCP_RUNTIME_SA_NAME:-chang-store-vertex-gateway}"
GCP_RUNTIME_SA_EMAIL="${GCP_RUNTIME_SA_EMAIL:-${GCP_RUNTIME_SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"

if [[ -z "${GCP_PROJECT_ID}" || "${GCP_PROJECT_ID}" == "(unset)" ]]; then
  echo "Missing GCP project. Set GCP_PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/${GCP_ENV_FILE}" ]]; then
  echo "Missing env file: ${ROOT_DIR}/${GCP_ENV_FILE}" >&2
  echo "Copy gcp/cloud-run.env.yaml.example to gcp/cloud-run.env.yaml first." >&2
  exit 1
fi

IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_AR_REPO}/${GCP_SERVICE_NAME}:$(date +%Y%m%d-%H%M%S)"

echo "==> Building image: ${IMAGE_URI}"
gcloud builds submit "${ROOT_DIR}" \
  --config "${ROOT_DIR}/gcp/cloudbuild-gateway.yaml" \
  --substitutions "_IMAGE_URI=${IMAGE_URI}"

echo "==> Deploying Cloud Run service: ${GCP_SERVICE_NAME}"
gcloud run deploy "${GCP_SERVICE_NAME}" \
  --image "${IMAGE_URI}" \
  --region "${GCP_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "${GCP_RUNTIME_SA_EMAIL}" \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 20 \
  --timeout 180 \
  --max-instances 10 \
  --env-vars-file "${ROOT_DIR}/${GCP_ENV_FILE}" \
  --update-secrets "/run/secrets/vertex-account.json=${GCP_SECRET_NAME}:${GCP_SECRET_VERSION}"

echo "==> Cloud Run URL"
gcloud run services describe "${GCP_SERVICE_NAME}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)'
