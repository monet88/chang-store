import { useState, useRef, useCallback, useEffect } from 'react';
import { submitJob, pollJob, getJobResults, downloadJobResultBlob, type Job, JobHttpError } from '../services/jobService';
import { ImageFile } from '../types';

interface UseJobPollOptions {
  pollIntervalMs?: number;
  onComplete?: (job: Job) => void;
  onFailed?: (job: Job) => void;
}

interface UseJobPollResult {
  job: Job | null;
  isPolling: boolean;
  error: string | null;
  submit: (feature: string, payload: Record<string, unknown>) => Promise<Job>;
  startPolling: (jobId: string) => void;
  stopPolling: () => void;
}

export const DEFAULT_JOB_POLL_INTERVAL_MS = 2000;
const MAX_JOB_PAYLOAD_BYTES = 4 * 1024 * 1024;

interface WaitForJobCompletionOptions {
  jobId: string;
  shouldContinue: () => boolean;
  onStatusUpdate?: (message: string) => void;
  pollIntervalMs?: number;
  ownerJobId?: string;
  activeJobIds?: Set<string>;
}

interface SharedJobState {
  job: Job | null;
  isPolling: boolean;
  error: string | null;
}

interface SharedJobUpdateOptions {
  ownerJobId?: string;
}

export function assertPayloadSizeBelowLimit(payload: unknown): void {
  const bytes = new Blob([JSON.stringify(payload)]).size;
  if (bytes > MAX_JOB_PAYLOAD_BYTES) {
    throw new Error('Payload too large. Reduce image count or resolution and try again.');
  }
}

export async function waitForJobCompletion({
  jobId,
  shouldContinue,
  onStatusUpdate,
  pollIntervalMs = DEFAULT_JOB_POLL_INTERVAL_MS,
  ownerJobId,
  activeJobIds,
}: WaitForJobCompletionOptions): Promise<Job> {
  while (shouldContinue()) {
    try {
      const job = await pollJob(jobId);
      const isPolling = job.status === 'queued' || job.status === 'running';
      if (!isPolling) {
        activeJobIds?.delete(jobId);
      }
      const nextIsPolling = activeJobIds ? activeJobIds.size > 0 : isPolling;
      setSharedJobState(
        {
          job,
          isPolling: nextIsPolling,
          error: job.status === 'failed' ? job.error_message || 'Job failed' : null,
        },
        { ownerJobId: ownerJobId ?? jobId },
      );
      onStatusUpdate?.(`Job ${job.status}...`);

      if (!isPolling) {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      activeJobIds?.delete(jobId);
      const message = error instanceof Error ? error.message : String(error);
      setSharedJobState(
        { isPolling: false, error: message },
        { ownerJobId: ownerJobId ?? jobId },
      );
      throw error;
    }
  }

  activeJobIds?.delete(jobId);
  setSharedJobState({ isPolling: false, error: null }, { ownerJobId: ownerJobId ?? jobId });
  throw new Error('Job polling cancelled');
}

export async function fetchJobImageResults(jobId: string): Promise<ImageFile[]> {
  const { results } = await getJobResults(jobId);
  const outputResults = results.filter((result) => result.kind === 'output');
  const images = await Promise.all(
    outputResults.map(async (result) => ({
      base64: await downloadJobResultBlob(result.blob_path),
      mimeType: result.mime_type,
    })),
  );
  return images;
}

const sharedJobListeners = new Set<(state: SharedJobState) => void>();
let sharedJobState: SharedJobState = {
  job: null,
  isPolling: false,
  error: null,
};
const activeSharedJobIds = new Set<string>();

function emitSharedJobState(nextState: Partial<SharedJobState>) {
  sharedJobState = {
    ...sharedJobState,
    ...nextState,
  };
  sharedJobListeners.forEach((listener) => listener(sharedJobState));
}

function syncActiveSharedJobs(nextState: Partial<SharedJobState>, options?: SharedJobUpdateOptions) {
  const ownerJobId = options?.ownerJobId;
  if (!ownerJobId || typeof nextState.isPolling !== 'boolean') {
    return;
  }

  if (nextState.isPolling) {
    activeSharedJobIds.add(ownerJobId);
    return;
  }

  activeSharedJobIds.delete(ownerJobId);
}

function resolveSharedPolling(nextState: Partial<SharedJobState>): Partial<SharedJobState> {
  if (typeof nextState.isPolling !== 'boolean') {
    return nextState;
  }

  return {
    ...nextState,
    isPolling: activeSharedJobIds.size > 0,
  };
}

function shouldApplySharedJobUpdate(
  nextState: Partial<SharedJobState>,
  options?: SharedJobUpdateOptions,
): boolean {
  if (typeof nextState.isPolling === 'boolean') {
    return true;
  }

  const ownerJobId = options?.ownerJobId;
  if (!ownerJobId) {
    return true;
  }

  const currentJobId = sharedJobState.job?.id ?? null;
  if (currentJobId === null || currentJobId === ownerJobId) {
    return true;
  }

  return !sharedJobState.isPolling;
}

function scopeNonOwnerUpdate(nextState: Partial<SharedJobState>, options?: SharedJobUpdateOptions): Partial<SharedJobState> {
  const ownerJobId = options?.ownerJobId;
  if (!ownerJobId) {
    return nextState;
  }

  const currentJobId = sharedJobState.job?.id ?? null;
  if (currentJobId === null || currentJobId === ownerJobId || activeSharedJobIds.size === 0) {
    return nextState;
  }

  const scoped: Partial<SharedJobState> = {};
  if (typeof nextState.isPolling === 'boolean') {
    scoped.isPolling = nextState.isPolling;
  }
  if (typeof nextState.error === 'string' && nextState.error.length > 0) {
    scoped.error = nextState.error;
  }

  return scoped;
}

export function setSharedJobState(nextState: Partial<SharedJobState>, options?: SharedJobUpdateOptions) {
  syncActiveSharedJobs(nextState, options);
  const scopedState = scopeNonOwnerUpdate(nextState, options);
  const resolvedState = resolveSharedPolling(scopedState);

  if (!shouldApplySharedJobUpdate(resolvedState, options)) {
    return;
  }

  emitSharedJobState(resolvedState);
}

export function clearSharedJobState() {
  activeSharedJobIds.clear();
  emitSharedJobState({ job: null, isPolling: false, error: null });
}

export function useSharedJobState(): SharedJobState {
  const [state, setState] = useState<SharedJobState>(sharedJobState);

  useEffect(() => {
    const listener = (nextState: SharedJobState) => {
      setState(nextState);
    };

    sharedJobListeners.add(listener);
    return () => {
      sharedJobListeners.delete(listener);
    };
  }, []);

  return state;
}

export function useJobPoll(options: UseJobPollOptions = {}): UseJobPollResult {
  const { pollIntervalMs = 3000, onComplete, onFailed } = options;
  const [job, setJob] = useState<Job | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef({ onComplete, onFailed });
  const activePollRef = useRef<{ jobId: string | null; generation: number }>({ jobId: null, generation: 0 });

  callbacksRef.current = { onComplete, onFailed };

  const clearPolling = useCallback((expected?: { jobId: string; generation: number }) => {
    if (
      expected && (
        activePollRef.current.jobId !== expected.jobId ||
        activePollRef.current.generation !== expected.generation
      )
    ) {
      return false;
    }

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    activePollRef.current = { jobId: null, generation: activePollRef.current.generation };
    setIsPolling(false);
    if (expected?.jobId) {
      setSharedJobState({ isPolling: false }, { ownerJobId: expected.jobId });
    } else {
      setSharedJobState({ isPolling: false });
    }
    return true;
  }, []);

  const doPoll = useCallback(async (jobId: string, generation: number) => {
    try {
      const current = await pollJob(jobId);
      if (activePollRef.current.jobId !== jobId || activePollRef.current.generation !== generation) {
        return;
      }

      setJob(current);

      if (current.status === 'completed' || current.status === 'partial') {
        setError(null);
        setSharedJobState({
          job: current,
          isPolling: false,
          error: null,
        }, { ownerJobId: jobId });
        clearPolling({ jobId, generation });
        callbacksRef.current.onComplete?.(current);
      } else if (current.status === 'failed') {
        const message = current.error_message || 'Job failed';
        setError(message);
        setSharedJobState({
          job: current,
          isPolling: false,
          error: message,
        }, { ownerJobId: jobId });
        clearPolling({ jobId, generation });
        callbacksRef.current.onFailed?.(current);
      } else {
        setError(null);
        setSharedJobState({
          job: current,
          isPolling: true,
          error: null,
        }, { ownerJobId: jobId });
      }
    } catch (err) {
      if (activePollRef.current.jobId !== jobId || activePollRef.current.generation !== generation) {
        return;
      }

      const message = err instanceof Error ? err.message : 'Unknown polling error';
      setError(message);
      clearPolling({ jobId, generation });
      setSharedJobState({ error: message, isPolling: false }, { ownerJobId: jobId });
    }
  }, [clearPolling]);

  const startPolling = useCallback((jobId: string) => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const generation = activePollRef.current.generation + 1;
    activePollRef.current = { jobId, generation };
    setIsPolling(true);
    setError(null);
    setSharedJobState({ isPolling: true, error: null }, { ownerJobId: jobId });
    void doPoll(jobId, generation);
    intervalRef.current = setInterval(() => {
      void doPoll(jobId, generation);
    }, pollIntervalMs);
  }, [doPoll, pollIntervalMs]);

  const stopPolling = useCallback(() => {
    const active = activePollRef.current;
    if (active.jobId) {
      clearPolling({ jobId: active.jobId, generation: active.generation });
      return;
    }
    clearPolling();
  }, [clearPolling]);

  const submit = useCallback(async (feature: string, payload: Record<string, unknown>): Promise<Job> => {
    setError(null);
    try {
      const newJob = await submitJob(feature, payload);
      setJob(newJob);
      setSharedJobState({
        job: newJob,
        isPolling: newJob.status !== 'completed' && newJob.status !== 'partial' && newJob.status !== 'failed',
        error: null,
      }, { ownerJobId: newJob.id });
      if (newJob.status !== 'completed' && newJob.status !== 'partial' && newJob.status !== 'failed') {
        startPolling(newJob.id);
      }
      return newJob;
    } catch (err) {
      if (err instanceof JobHttpError) {
        const message = `Job submission failed (${err.status}): ${JSON.stringify(err.body)}`;
        setError(message);
        if (!sharedJobState.isPolling) {
          setSharedJobState({ error: message, isPolling: false });
        }
      } else {
        const message = err instanceof Error ? err.message : 'Unknown submission error';
        setError(message);
        if (!sharedJobState.isPolling) {
          setSharedJobState({ error: message, isPolling: false });
        }
      }
      throw err;
    }
  }, [startPolling]);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  return {
    job,
    isPolling,
    error,
    submit,
    startPolling,
    stopPolling,
  };
}
