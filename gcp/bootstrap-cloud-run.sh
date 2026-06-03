#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-asia-southeast1}"
AR_REPO="${GCP_AR_REPO:-chang-store}"
RUNTIME_SA_NAME="${GCP_RUNTIME_SA_NAME:-chang-store-vertex-gateway}"
RUNTIME_SA_EMAIL="${GCP_RUNTIME_SA_EMAIL:-${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com}"
SECRET_NAME="${GCP_SECRET_NAME:-chang-store-vertex-account}"
ACCOUNT_JSON_PATH="${GCP_ACCOUNT_JSON_PATH:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Missing GCP project. Set GCP_PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

if [[ -z "${ACCOUNT_JSON_PATH}" ]]; then
  echo "Missing GCP_ACCOUNT_JSON_PATH. Point it to your local service account JSON file." >&2
  exit 1
fi

if [[ ! -f "${ACCOUNT_JSON_PATH}" ]]; then
  echo "Service account JSON file not found: ${ACCOUNT_JSON_PATH}" >&2
  exit 1
fi

echo "==> Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com

echo "==> Ensuring Artifact Registry repo exists: ${AR_REPO}"
if ! gcloud artifacts repositories describe "${AR_REPO}" --location "${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format docker \
    --location "${REGION}" \
    --description "Chang Store gateway images"
fi

echo "==> Ensuring runtime service account exists: ${RUNTIME_SA_EMAIL}"
if ! gcloud iam service-accounts describe "${RUNTIME_SA_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SA_NAME}" \
    --display-name "Chang Store Vertex Gateway"
fi

echo "==> Granting runtime roles"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role "roles/aiplatform.user" >/dev/null

if gcloud secrets describe "${SECRET_NAME}" >/dev/null 2>&1; then
  gcloud secrets versions add "${SECRET_NAME}" --data-file="${ACCOUNT_JSON_PATH}"
else
  gcloud secrets create "${SECRET_NAME}" --data-file="${ACCOUNT_JSON_PATH}"
fi

gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role "roles/secretmanager.secretAccessor" >/dev/null

echo "==> Bootstrap complete"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
echo "Runtime service account: ${RUNTIME_SA_EMAIL}"
echo "Secret: ${SECRET_NAME}"
