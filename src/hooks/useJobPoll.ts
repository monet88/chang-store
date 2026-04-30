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

export function useJobPoll(options: UseJobPollOptions = {}): UseJobPollResult {
  const { pollIntervalMs = 3000, onComplete, onFailed } = options;
  const [job, setJob] = useState<Job | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef({ onComplete, onFailed });

  callbacksRef.current = { onComplete, onFailed };

  const clearPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const doPoll = useCallback(async (jobId: string) => {
    try {
      const current = await pollJob(jobId);
      setJob(current);
      setError(null);

      if (current.status === 'completed' || current.status === 'partial') {
        clearPolling();
        callbacksRef.current.onComplete?.(current);
      } else if (current.status === 'failed') {
        clearPolling();
        callbacksRef.current.onFailed?.(current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown polling error');
    }
  }, [clearPolling]);

  const startPolling = useCallback((jobId: string) => {
    clearPolling();
    setIsPolling(true);
    doPoll(jobId);
    intervalRef.current = setInterval(() => doPoll(jobId), pollIntervalMs);
  }, [clearPolling, doPoll, pollIntervalMs]);

  const stopPolling = useCallback(() => {
    clearPolling();
  }, [clearPolling]);

  const submit = useCallback(async (feature: string, payload: Record<string, unknown>): Promise<Job> => {
    setError(null);
    try {
      const newJob = await submitJob(feature, payload);
      setJob(newJob);
      if (newJob.status !== 'completed' && newJob.status !== 'partial' && newJob.status !== 'failed') {
        startPolling(newJob.id);
      }
      return newJob;
    } catch (err) {
      if (err instanceof JobHttpError) {
        setError(`Job submission failed (${err.status}): ${JSON.stringify(err.body)}`);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown submission error');
      }
      throw err;
    }
  }, [startPolling]);

  useEffect(() => {
    return () => clearPolling();
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
