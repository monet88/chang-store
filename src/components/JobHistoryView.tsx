import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CloseIcon, RefreshIcon, CheckCircleIcon, ErrorIcon, LoadingSpinnerIcon, HistoryIcon } from './Icons';
import { useJobHistoryView } from '../hooks/useJobHistoryView';
import type { Job } from '../types';

interface JobHistoryViewProps {
  onClose: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
  'try-on': 'tabs.tryOn',
  'lookbook': 'tabs.lookbook',
  'clothing-transfer': 'tabs.clothingTransfer',
  'photo-album': 'tabs.photoAlbum',
  'background': 'tabs.background',
  'pose': 'tabs.pose',
  'ai-editor': 'tabs.aiEditor',
  'watermark-remover': 'tabs.watermarkRemover',
  'pattern-generator': 'tabs.patternGenerator',
};

const statusColors: Record<string, string> = {
  queued: 'text-amber-300 bg-amber-900/40',
  running: 'text-amber-300 bg-amber-900/40',
  completed: 'text-green-300 bg-green-900/40',
  partial: 'text-green-300 bg-green-900/40',
  failed: 'text-red-300 bg-red-900/40',
};

const JobStatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'queued' || status === 'running') {
    return <LoadingSpinnerIcon className={`h-4 w-4 ${status === 'running' ? 'animate-spin' : ''} text-amber-400`} />;
  }
  if (status === 'completed' || status === 'partial') {
    return <CheckCircleIcon className="h-4 w-4 text-green-400" />;
  }
  if (status === 'failed') {
    return <ErrorIcon className="h-4 w-4 text-red-400" />;
  }
  return null;
};

const formatTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    return '-';
  }

  return d.toLocaleString();
};

const JobHistoryView: React.FC<JobHistoryViewProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const {
    jobs,
    isLoading,
    error,
    expandedJobId,
    jobResults,
    loadingResults,
    fetchJobs,
    handleJobClick,
  } = useJobHistoryView(onClose);

  const progressPercent = (job: Job): number => {
    if (job.progress_total === 0) return 0;
    return Math.round((job.progress_done / job.progress_total) * 100);
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex justify-between items-center p-4 text-white w-full max-w-3xl mx-auto flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30">
            <HistoryIcon className="h-5 w-5 text-zinc-100" />
          </span>
          <h2 className="text-xl md:text-2xl font-bold">
            {t('jobs.history.title')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetchJobs(); }}
            className="workspace-button rounded-xl px-3 py-2"
            aria-label={t('jobs.history.refresh')}
          >
            <RefreshIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
            aria-label={t('jobs.history.close')}
          >
            <CloseIcon className="w-7 h-7" />
          </button>
        </div>
      </div>

      <div
        className="flex-grow overflow-y-auto px-4 pb-8 max-w-3xl w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinnerIcon className="h-8 w-8 animate-spin text-amber-400" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <ErrorIcon className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-300">{error}</p>
            <button onClick={fetchJobs} className="workspace-button mt-4 px-4 py-2">
              {t('jobs.history.refresh')}
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <HistoryIcon className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-lg">{t('jobs.history.empty')}</p>
            <p className="text-zinc-600 text-sm mt-1">{t('jobs.history.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const isExpanded = expandedJobId === job.id;
              const results = jobResults[job.id];
              const isLoadingResults = loadingResults.has(job.id);

              return (
                <div key={job.id}>
                  <button
                    type="button"
                    onClick={() => handleJobClick(job)}
                    className="workspace-panel w-full rounded-2xl p-4 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30">
                        <JobStatusIcon status={job.status} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-zinc-100">
                            {t(FEATURE_LABELS[job.feature] || 'tabs.tryOn')}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[job.status] || ''}`}>
                            {t(`jobs.status.${job.status}`)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <span className="text-xs text-zinc-500">{formatTime(job.created_at)}</span>
                          {(job.status === 'running' || job.status === 'completed' || job.status === 'partial') && job.progress_total > 0 && (
                            <span className="text-xs text-zinc-500">
                              {job.progress_done}/{job.progress_total}
                            </span>
                          )}
                        </div>
                        {(job.status === 'queued' || job.status === 'running') && job.progress_total > 0 && (
                          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-amber-400 transition-all"
                              style={{ width: `${progressPercent(job)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 border-t border-white/10 pt-3" onClick={(e) => e.stopPropagation()}>
                        {(job.status === 'completed' || job.status === 'partial') && (
                          <div className="space-y-2">
                            {isLoadingResults ? (
                              <div className="flex items-center gap-2 text-zinc-400">
                                <LoadingSpinnerIcon className="h-4 w-4 animate-spin" />
                                <span className="text-xs">Loading results...</span>
                              </div>
                            ) : results && results.length > 0 ? (
                              <p className="text-xs text-zinc-400">
                                {t('jobs.history.resultCount', { count: results.length })}
                              </p>
                            ) : (
                              <p className="text-xs text-zinc-500">{t('jobs.history.noDetails')}</p>
                            )}
                          </div>
                        )}
                        {job.error_message && (
                          <p className="text-xs text-red-400 mt-2">{job.error_message}</p>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobHistoryView;
