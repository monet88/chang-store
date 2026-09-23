import React from 'react';
import {
  type DesktopLocalQwenStatus,
  classifyLocalQwenError,
} from '../../platform/desktopLocalQwen';
import { useLocalQwenStatus } from '../../hooks/useLocalQwenStatus';
import { useLanguage } from '../../contexts/LanguageContext';
const getProgressWidthClass = (percent: number): string => {
  if (percent <= 0) return 'w-0';
  if (percent <= 5) return 'w-[5%]';
  if (percent <= 10) return 'w-[10%]';
  if (percent <= 15) return 'w-[15%]';
  if (percent <= 20) return 'w-[20%]';
  if (percent <= 25) return 'w-[25%]';
  if (percent <= 30) return 'w-[30%]';
  if (percent <= 35) return 'w-[35%]';
  if (percent <= 40) return 'w-[40%]';
  if (percent <= 45) return 'w-[45%]';
  if (percent <= 50) return 'w-[50%]';
  if (percent <= 55) return 'w-[55%]';
  if (percent <= 60) return 'w-[60%]';
  if (percent <= 65) return 'w-[65%]';
  if (percent <= 70) return 'w-[70%]';
  if (percent <= 75) return 'w-[75%]';
  if (percent <= 80) return 'w-[80%]';
  if (percent <= 85) return 'w-[85%]';
  if (percent <= 90) return 'w-[90%]';
  if (percent <= 95) return 'w-[95%]';
  return 'w-full';
};

export interface LocalQwenStatusBannerProps {
  status?: DesktopLocalQwenStatus;
  isCancelling?: boolean;
  isStarting?: boolean;
  isStopping?: boolean;
  onOpenSettings?: () => void;
  onRetry?: () => void;
  onStartServer?: () => void;
  onReleaseGpu?: () => void;
  onCancelJob?: () => void;
  className?: string;
}

export const LocalQwenStatusBanner: React.FC<LocalQwenStatusBannerProps> = ({
  status: controlledStatus,
  isCancelling: controlledIsCancelling,
  isStarting: controlledIsStarting,
  isStopping: controlledIsStopping,
  onOpenSettings,
  onRetry: controlledOnRetry,
  onStartServer: controlledOnStartServer,
  onReleaseGpu: controlledOnReleaseGpu,
  onCancelJob: controlledOnCancelJob,
  className = '',
}) => {
  const { t } = useLanguage();
  const internal = useLocalQwenStatus({
    autoRefresh: !controlledStatus,
  });

  const status = controlledStatus ?? internal.status;
  const isCancelling = controlledIsCancelling ?? internal.isCancelling;
  const isStarting = controlledIsStarting ?? internal.isStarting;
  const isStopping = controlledIsStopping ?? internal.isStopping;
  const handleRetry = controlledOnRetry ?? internal.retry;
  const handleStartServer = controlledOnStartServer ?? (() => void internal.startServer());
  const handleCancelJob = controlledOnCancelJob ?? (() => void internal.cancelJob());
  const handleReleaseGpu = controlledOnReleaseGpu ?? (() => void internal.releaseGpu());

  const renderReleaseGpuButton = (extraClass = 'px-2.5 py-1') => (
    <button
      type="button"
      onClick={handleReleaseGpu}
      disabled={isStopping}
      data-testid="release-gpu-button"
      className={`rounded-lg border border-amber-500/40 bg-amber-950/40 ${extraClass} text-xs font-medium text-amber-200 transition hover:bg-amber-900/60 disabled:opacity-50`}
    >
      {isStopping
        ? t('studio.localQwenStatus.releasingGpu')
        : t('studio.localQwenStatus.releaseGpu')}
    </button>
  );

  const renderOpenSettingsButton = (extraTestId?: string, extraClass = 'px-2.5 py-1 text-zinc-200') =>
    onOpenSettings ? (
      <button
        type="button"
        onClick={onOpenSettings}
        data-testid={extraTestId}
        className={`rounded-lg border border-zinc-700 bg-zinc-800/80 ${extraClass} text-xs font-medium transition hover:bg-zinc-700 hover:text-white`}
      >
        {t('studio.localQwenStatus.openSettings')}
      </button>
    ) : null;

  const renderContent = () => {
    switch (status.state) {
      case 'starting':
        return (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  {t('studio.localQwenStatus.starting')}
                </p>
                <p className="text-xs text-zinc-400">
                  {t('studio.localQwenStatus.startingSubtext')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">127.0.0.1:{status.port}</span>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-emerald-400">
                    {t('studio.localQwenStatus.ready')}
                  </p>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                    {status.isAppOwned
                      ? t('studio.localQwenStatus.appOwned')
                      : t('studio.localQwenStatus.external')}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  {t('studio.localQwenStatus.readySubtext')} (127.0.0.1:{status.port})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status.isAppOwned && renderReleaseGpuButton('px-2.5 py-1')}
              {renderOpenSettingsButton()}
            </div>
          </div>
        );

      case 'generating': {
        const hasProgress = status.progress !== undefined;
        const step = status.progress?.step ?? 0;
        const maxSteps = status.progress?.maxSteps ?? 16;
        const percent = Math.min(100, Math.round((step / Math.max(1, maxSteps)) * 100));

        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-sky-400">
                      {t('studio.localQwenStatus.generating')}
                    </p>
                    {hasProgress ? (
                      <span className="rounded bg-sky-950/80 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
                        {t('studio.localQwenStatus.stepProgress', { step, maxSteps })}
                      </span>
                    ) : (
                      <span className="rounded bg-sky-950/80 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
                        {t('studio.localQwenStatus.generating')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    {t('studio.localQwenStatus.generatingSubtext')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelJob}
                  disabled={isCancelling}
                  data-testid="cancel-local-qwen-job"
                  className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-1.5 text-xs font-semibold text-rose-200 shadow-sm transition hover:bg-rose-900/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCancelling
                    ? t('studio.localQwenStatus.cancelling')
                    : t('studio.localQwenStatus.cancel')}
                </button>
              </div>
            </div>

            {/* Sampling Progress Bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300 ease-out ${
                  hasProgress ? getProgressWidthClass(percent) : 'animate-pulse w-full'
                }`}
              />
            </div>
          </div>
        );
      }

      case 'error': {
        const classified = classifyLocalQwenError(status.error, t);

        return (
          <div className="flex flex-col gap-3" data-testid="local-qwen-error-banner">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-rose-300">
                    {classified.title}
                  </p>
                  <p className="text-xs text-zinc-300">
                    {classified.actionableSuggestion}
                  </p>
                  {status.error && status.error !== classified.actionableSuggestion && (
                    <p className="text-[11px] font-mono text-zinc-400 break-all">
                      {status.error}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {status.isAppOwned && renderReleaseGpuButton('px-3 py-1.5')}
                <button
                  type="button"
                  onClick={handleRetry}
                  data-testid="local-qwen-retry-button"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700"
                >
                  {t('studio.localQwenStatus.retry')}
                </button>
                {renderOpenSettingsButton('local-qwen-open-settings-button', 'px-3 py-1.5 text-zinc-100')}
              </div>
            </div>
          </div>
        );
      }

      case 'stopped':
      default:
        return (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 rounded-full bg-zinc-500" />
              <div>
                <p className="text-sm font-semibold text-zinc-300">
                  {t('studio.localQwenStatus.stopped')}
                </p>
                <p className="text-xs text-zinc-400">
                  {t('studio.localQwenStatus.stoppedSubtext')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartServer}
                disabled={isStarting}
                data-testid="start-local-comfyui-button"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {isStarting
                  ? t('studio.localQwenStatus.starting')
                  : t('studio.localQwenStatus.startServer')}
              </button>
              {renderOpenSettingsButton(undefined, 'px-3 py-1.5')}
            </div>
          </div>
        );
    }
  };

  const getBorderColor = () => {
    switch (status.state) {
      case 'starting':
        return 'border-amber-500/30 bg-amber-950/10';
      case 'ready':
        return 'border-emerald-500/20 bg-emerald-950/10';
      case 'generating':
        return 'border-sky-500/30 bg-sky-950/10';
      case 'error':
        return 'border-rose-500/40 bg-rose-950/20';
      case 'stopped':
      default:
        return 'border-zinc-800 bg-zinc-900/50';
    }
  };

  return (
    <div
      data-testid="local-qwen-status-banner"
      className={`rounded-xl border p-4 transition-colors ${getBorderColor()} ${className}`}
    >
      {renderContent()}
    </div>
  );
};

export default LocalQwenStatusBanner;
