import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LoadingSpinnerIcon, CheckCircleIcon, ErrorIcon, CloseIcon } from './Icons';
import type { Job } from '../types';

interface JobStatusBadgeProps {
  job: Job | null;
  isPolling: boolean;
  onCancel?: () => void;
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

const JobStatusBadge: React.FC<JobStatusBadgeProps> = ({ job, isPolling, onCancel }) => {
  const { t } = useLanguage();

  if (!job) return null;

  const status = job.status;
  const featureLabel = t(FEATURE_LABELS[job.feature] || 'tabs.tryOn');
  const statusText = t(`jobs.status.${status}`);
  const hasProgressTotal = job.progress_total > 0;
  const progressTotal = hasProgressTotal ? job.progress_total : 1;
  const progressDone = Math.min(job.progress_done, progressTotal);
  const progressPercent = Math.round((progressDone / progressTotal) * 100);

  const isActive = status === 'queued' || status === 'running';
  const isComplete = status === 'completed' || status === 'partial';
  const isFailed = status === 'failed';

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      <div className="workspace-panel flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30">
          {isActive && <LoadingSpinnerIcon className="h-4 w-4 animate-spin text-amber-400" />}
          {isComplete && <CheckCircleIcon className="h-4 w-4 text-green-400" />}
          {isFailed && <ErrorIcon className="h-4 w-4 text-red-400" />}
        </span>

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
            {t('jobs.badge.featureLabel')}: {featureLabel}
          </span>
          <span className={`text-sm font-medium ${
            isActive ? 'text-amber-300' :
            isComplete ? 'text-green-300' :
            'text-red-300'
          }`}>
            {statusText}
          </span>
          {isActive && hasProgressTotal && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">
                {progressDone}/{progressTotal}
              </span>
            </div>
          )}
        </div>

        {isActive && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition-colors hover:text-white hover:border-white/20"
            aria-label={t('jobs.badge.cancel')}
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default JobStatusBadge;
