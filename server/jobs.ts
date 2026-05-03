import type { JobRecord, JobStatus } from './db';

export const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['running', 'failed'],
  running: ['completed', 'failed', 'partial'],
  completed: [],
  failed: [],
  partial: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionStatus(
  job: JobRecord,
  newStatus: JobStatus,
  opts?: { errorCode?: string; errorMessage?: string; progressDone?: number },
): { status: JobStatus; errorCode: string | null; errorMessage: string | null; progressDone: number } {
  if (!canTransition(job.status, newStatus)) {
    throw new Error(`Invalid status transition: ${job.status} → ${newStatus}`);
  }
  return {
    status: newStatus,
    errorCode: opts?.errorCode ?? null,
    errorMessage: opts?.errorMessage ?? null,
    progressDone: opts?.progressDone ?? job.progress_done,
  };
}
