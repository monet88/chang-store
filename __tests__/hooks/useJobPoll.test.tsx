import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Job } from '../../src/services/jobService';

const pollJobMock = vi.fn();
const submitJobMock = vi.fn();

vi.mock('../../src/services/jobService', () => ({
  pollJob: (...args: unknown[]) => pollJobMock(...args),
  submitJob: (...args: unknown[]) => submitJobMock(...args),
  JobHttpError: class JobHttpError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super(`Job API error (${status})`);
      this.status = status;
      this.body = body;
    }
  },
}));

import {
  clearSharedJobState,
  setSharedJobState,
  useJobPoll,
  useSharedJobState,
  waitForJobCompletion,
} from '../../src/hooks/useJobPoll';

function makeJob(id: string, status: Job['status'], errorMessage: string | null = null): Job {
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
    error_code: errorMessage ? 'FAILED' : null,
    error_message: errorMessage,
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

describe('useJobPoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearSharedJobState();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearSharedJobState();
  });

  it('stops polling and exposes error when pollJob rejects', async () => {
    pollJobMock.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => {
      const poll = useJobPoll({ pollIntervalMs: 1000 });
      const shared = useSharedJobState();
      return { poll, shared };
    });

    act(() => {
      result.current.poll.startPolling('job-1');
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.poll.error).toBe('network down');
    expect(result.current.poll.isPolling).toBe(false);
    expect(result.current.shared.isPolling).toBe(false);
    expect(result.current.shared.error).toBe('network down');
  });

  it('clears shared polling when waitForJobCompletion fails with stale active job ids', async () => {
    pollJobMock.mockRejectedValueOnce(new Error('network down'));
    const activeJobIds = new Set(['stale-job', 'job-1']);

    const { result } = renderHook(() => useSharedJobState());

    await act(async () => {
      await expect(waitForJobCompletion({
        jobId: 'job-1',
        shouldContinue: () => true,
        pollIntervalMs: 1000,
        ownerJobId: 'job-1',
        activeJobIds,
      })).rejects.toThrow('network down');
    });

    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBe('network down');
    expect(activeJobIds.has('job-1')).toBe(false);
  });

  it('surfaces non-owner errors while another shared job is still polling', () => {
    const { result } = renderHook(() => useSharedJobState());

    act(() => {
      setSharedJobState({ job: makeJob('job-1', 'running'), isPolling: true, error: null }, { ownerJobId: 'job-1' });
      setSharedJobState({ job: makeJob('job-2', 'failed', 'backend failed'), isPolling: false, error: 'backend failed' }, { ownerJobId: 'job-2' });
    });

    expect(result.current.job?.id).toBe('job-1');
    expect(result.current.isPolling).toBe(true);
    expect(result.current.error).toBe('backend failed');
  });

  it('ignores stale terminal responses from an older poll generation', async () => {
    const firstPoll = createDeferred<Job>();
    const secondPoll = createDeferred<Job>();

    pollJobMock
      .mockImplementationOnce(() => firstPoll.promise)
      .mockImplementationOnce(() => secondPoll.promise);

    const { result } = renderHook(() => {
      const poll = useJobPoll({ pollIntervalMs: 1000 });
      const shared = useSharedJobState();
      return { poll, shared };
    });

    act(() => {
      result.current.poll.startPolling('job-1');
      result.current.poll.startPolling('job-2');
    });

    await act(async () => {
      firstPoll.resolve(makeJob('job-1', 'completed'));
      await Promise.resolve();
    });

    expect(result.current.poll.isPolling).toBe(true);
    expect(result.current.shared.isPolling).toBe(true);

    await act(async () => {
      secondPoll.resolve(makeJob('job-2', 'running'));
      await Promise.resolve();
    });

    expect(result.current.poll.job?.id).toBe('job-2');
    expect(result.current.poll.isPolling).toBe(true);
    expect(result.current.shared.isPolling).toBe(true);
  });
});

