import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Job, JobResult } from '../../src/types';

const listJobsMock = vi.fn();
const getJobResultsMock = vi.fn();

vi.mock('../../src/services/jobService', () => ({
  listJobs: (...args: unknown[]) => listJobsMock(...args),
  getJobResults: (...args: unknown[]) => getJobResultsMock(...args),
}));

import { useJobHistoryView } from '../../src/hooks/useJobHistoryView';

function makeJob(id: string, status: Job['status'] = 'completed'): Job {
  return {
    id,
    user_id: 'demo',
    feature: 'lookbook',
    status,
    idempotency_key: `key-${id}`,
    input_payload_json: {},
    workflow_run_id: null,
    progress_total: 1,
    progress_done: status === 'completed' ? 1 : 0,
    created_at: '2026-01-01T00:00:00.000Z',
    started_at: '2026-01-01T00:00:00.000Z',
    completed_at: status === 'completed' ? '2026-01-01T00:00:01.000Z' : null,
    error_code: null,
    error_message: null,
  };
}

function makeResult(jobId: string): JobResult {
  return {
    id: `${jobId}-result`,
    job_id: jobId,
    kind: 'output',
    blob_path: `${jobId}/result.png`,
    mime_type: 'image/png',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useJobHistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listJobsMock.mockResolvedValue([makeJob('job-1')]);
    getJobResultsMock.mockResolvedValue({ results: [makeResult('job-1')] });
  });

  it('avoids duplicate in-flight result fetches for same job', async () => {
    const deferred = createDeferred<{ results: JobResult[] }>();
    getJobResultsMock.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => useJobHistoryView(vi.fn()));

    await waitFor(() => expect(result.current.jobs).toHaveLength(1));
    const job = result.current.jobs[0];

    act(() => {
      void result.current.handleJobClick(job);
      void result.current.handleJobClick(job);
    });

    expect(getJobResultsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ results: [makeResult('job-1')] });
      await deferred.promise;
    });

    expect(result.current.jobResults['job-1']).toEqual([makeResult('job-1')]);
    expect(result.current.loadingResults.has('job-1')).toBe(false);
  });
});
