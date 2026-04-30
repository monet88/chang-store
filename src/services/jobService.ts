const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

function getCsrfToken(): string | null {
  return document.cookie.split('; ').find(row => row.startsWith(CSRF_COOKIE_NAME + '='))?.split('=')[1] ?? null;
}

function baseUrl(): string {
  return window.location.origin;
}

async function fetchJson(path: string, init?: RequestInit): Promise<Response> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'partial';

export interface Job {
  id: string;
  user_id: string;
  feature: string;
  status: JobStatus;
  idempotency_key: string;
  input_payload_json: Record<string, unknown>;
  workflow_run_id: string | null;
  progress_total: number;
  progress_done: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

export interface JobResult {
  id: string;
  job_id: string;
  kind: 'input' | 'output';
  blob_path: string;
  mime_type: string;
  created_at: string;
}

export interface JobAsset {
  blobPath: string;
  mimeType: string;
}

export class JobHttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Job API error (${status}): ${JSON.stringify(body)}`);
    this.name = 'JobHttpError';
    this.status = status;
    this.body = body;
  }
}

function checkResponse(response: Response): Response {
  if (!response.ok) {
    throw new JobHttpError(response.status, response.statusText);
  }
  return response;
}

export async function submitJob(feature: string, payload: Record<string, unknown>): Promise<Job> {
  const response = await fetchJson('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature, payload }),
  });

  if (response.status === 409) {
    throw new JobHttpError(409, { message: 'Job already exists and is not yet complete.' });
  }
  if (response.status === 422) {
    const body = await response.json();
    throw new JobHttpError(422, body);
  }

  checkResponse(response);
  return (await response.json()) as Job;
}

export async function getJob(jobId: string): Promise<{ job: Job; events: unknown[] }> {
  const response = await fetchJson(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
  });
  checkResponse(response);
  return (await response.json()) as { job: Job; events: unknown[] };
}

export async function getJobResults(jobId: string): Promise<{ job: Job; results: JobResult[] }> {
  const response = await fetchJson(`/api/jobs/${encodeURIComponent(jobId)}/results`, {
    method: 'GET',
  });
  if (response.status === 409) {
    throw new JobHttpError(409, { message: 'Job not complete.' });
  }
  checkResponse(response);
  return (await response.json()) as { job: Job; results: JobResult[] };
}

export async function pollJob(jobId: string): Promise<Job> {
  const { job } = await getJob(jobId);
  return job;
}

export async function listJobs(params?: { status?: JobStatus; limit?: number; offset?: number }): Promise<Job[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));

  const qs = query.toString();
  const path = qs ? `/api/jobs?${qs}` : '/api/jobs';

  const response = await fetchJson(path, { method: 'GET' });
  checkResponse(response);
  return (await response.json()) as Job[];
}

export async function downloadJobResultBlob(blobPath: string): Promise<string> {
  const response = await fetch(`${baseUrl()}/api/assets/${encodeURIComponent(blobPath)}`, {
    credentials: 'include',
    headers: (() => {
      const csrfToken = getCsrfToken();
      const h: Record<string, string> = {};
      if (csrfToken) h[CSRF_HEADER_NAME] = csrfToken;
      return h;
    })(),
  });
  if (!response.ok) {
    throw new JobHttpError(response.status, response.statusText);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
