import { useState, useRef, useCallback, useEffect } from 'react';
import { submitJob, pollJob, type Job, JobHttpError } from '../services/jobService';

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

interface SharedJobState {
  job: Job | null;
  isPolling: boolean;
  error: string | null;
}

const sharedJobListeners = new Set<(state: SharedJobState) => void>();
let sharedJobState: SharedJobState = {
  job: null,
  isPolling: false,
  error: null,
};

function emitSharedJobState(nextState: Partial<SharedJobState>) {
  sharedJobState = {
    ...sharedJobState,
    ...nextState,
  };
  sharedJobListeners.forEach((listener) => listener(sharedJobState));
}

export function setSharedJobState(nextState: Partial<SharedJobState>) {
  emitSharedJobState(nextState);
}

export function clearSharedJobState() {
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
    emitSharedJobState({ isPolling: false });
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
        emitSharedJobState({
          job: current,
          isPolling: false,
          error: null,
        });
        clearPolling({ jobId, generation });
        callbacksRef.current.onComplete?.(current);
      } else if (current.status === 'failed') {
        const message = current.error_message || 'Job failed';
        setError(message);
        emitSharedJobState({
          job: current,
          isPolling: false,
          error: message,
        });
        clearPolling({ jobId, generation });
        callbacksRef.current.onFailed?.(current);
      } else {
        setError(null);
        emitSharedJobState({
          job: current,
          isPolling: true,
          error: null,
        });
      }
    } catch (err) {
      if (activePollRef.current.jobId !== jobId || activePollRef.current.generation !== generation) {
        return;
      }

      const message = err instanceof Error ? err.message : 'Unknown polling error';
      setError(message);
      clearPolling({ jobId, generation });
      emitSharedJobState({ error: message, isPolling: false });
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
    emitSharedJobState({ isPolling: true, error: null });
    void doPoll(jobId, generation);
    intervalRef.current = setInterval(() => {
      void doPoll(jobId, generation);
    }, pollIntervalMs);
  }, [doPoll, pollIntervalMs]);

  const stopPolling = useCallback(() => {
    clearPolling();
  }, [clearPolling]);

  const submit = useCallback(async (feature: string, payload: Record<string, unknown>): Promise<Job> => {
    setError(null);
    try {
      const newJob = await submitJob(feature, payload);
      setJob(newJob);
      emitSharedJobState({
        job: newJob,
        isPolling: newJob.status !== 'completed' && newJob.status !== 'partial' && newJob.status !== 'failed',
        error: null,
      });
      if (newJob.status !== 'completed' && newJob.status !== 'partial' && newJob.status !== 'failed') {
        startPolling(newJob.id);
      }
      return newJob;
    } catch (err) {
      if (err instanceof JobHttpError) {
        const message = `Job submission failed (${err.status}): ${JSON.stringify(err.body)}`;
        setError(message);
        emitSharedJobState({ error: message, isPolling: false });
      } else {
        const message = err instanceof Error ? err.message : 'Unknown submission error';
        setError(message);
        emitSharedJobState({ error: message, isPolling: false });
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
