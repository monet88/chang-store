import { useCallback, useEffect, useRef, useState } from 'react';
import { listJobs, getJobResults } from '../services/jobService';
import type { Job, JobResult } from '../types';

export function useJobHistoryView(onClose: () => void) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<Record<string, JobResult[]>>({});
  const [loadingResults, setLoadingResults] = useState<Set<string>>(new Set());
  const inFlightResultsRef = useRef<Set<string>>(new Set());

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listJobs({ limit: 30 });
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const handleJobClick = useCallback(async (job: Job) => {
    if (expandedJobId === job.id) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(job.id);

    if (job.status === 'completed' || job.status === 'partial') {
      if (!jobResults[job.id] && !inFlightResultsRef.current.has(job.id)) {
        inFlightResultsRef.current.add(job.id);
        setLoadingResults(prev => new Set(prev).add(job.id));
        try {
          const { results } = await getJobResults(job.id);
          setJobResults(prev => ({ ...prev, [job.id]: results }));
        } catch {
          // ignore detail fetch errors
        } finally {
          inFlightResultsRef.current.delete(job.id);
          setLoadingResults(prev => {
            const next = new Set(prev);
            next.delete(job.id);
            return next;
          });
        }
      }
    }
  }, [expandedJobId, jobResults]);

  return {
    jobs,
    isLoading,
    error,
    expandedJobId,
    jobResults,
    loadingResults,
    fetchJobs,
    handleJobClick,
  };
}
