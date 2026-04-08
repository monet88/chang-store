/**
 * WatermarkRemoverOutput - Grid display for batch watermark removal results
 *
 * Features:
 * - Grid layout with per-item cards
 * - Status indicator (pending/processing/success/error)
 * - Progress display during batch processing
 * - Inline retry dropdown with prompt selection
 * - Save/Download for individual items
 * - Batch actions: Save All, Download ZIP
 */

import React, { useCallback, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { WATERMARK_PROMPTS } from '../utils/watermark-prompts';
import HoverableImage from './HoverableImage';
import Spinner from './Spinner';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { Feature, type WatermarkBatchItem } from '../types';

interface WatermarkRemoverOutputProps {
  items: WatermarkBatchItem[];
  isProcessing: boolean;
  completedCount: number;
  totalCount: number;
  successCount: number;
  errorCount: number;
  onRetry: (id: string, promptId?: string) => Promise<void>;
  onSaveToGallery: (item: WatermarkBatchItem) => void;
  onSaveAllToGallery: () => void;
  onDownloadItem: (item: WatermarkBatchItem) => void;
  onDownloadAllZip: () => Promise<void>;
  onRemoveItem: (id: string) => void;
}

type RetryDropdownState = { itemId: string; isOpen: boolean } | null;

export const WatermarkRemoverOutput = React.memo<WatermarkRemoverOutputProps>(({
  items,
  isProcessing,
  completedCount,
  totalCount,
  successCount,
  errorCount,
  onRetry,
  onSaveToGallery,
  onSaveAllToGallery,
  onDownloadItem,
  onDownloadAllZip,
  onRemoveItem,
}) => {
  const { t } = useLanguage();
  const [retryDropdown, setRetryDropdown] = useState<RetryDropdownState>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleRetryClick = useCallback((itemId: string) => {
    setRetryDropdown(prev =>
      prev?.itemId === itemId ? null : { itemId, isOpen: true }
    );
  }, []);

  const handleRetryWithPrompt = useCallback(async (itemId: string, promptId: string) => {
    setRetryDropdown(null);
    await onRetry(itemId, promptId);
  }, [onRetry]);

  const handleDownloadAllZip = useCallback(async () => {
    setIsDownloadingZip(true);
    try {
      await onDownloadAllZip();
    } finally {
      setIsDownloadingZip(false);
    }
  }, [onDownloadAllZip]);

  const getStatusIcon = (status: WatermarkBatchItem['status']) => {
    switch (status) {
      case 'pending':
        return <span className="text-zinc-400">⏳</span>;
      case 'processing':
        return <Spinner />;
      case 'completed':
        return <span className="text-green-400">✓</span>;
      case 'error':
        return <span className="text-red-400">✗</span>;
    }
  };

  const getStatusText = (status: WatermarkBatchItem['status']) => {
    switch (status) {
      case 'pending':
        return t('watermarkRemover.status.pending');
      case 'processing':
        return t('watermarkRemover.status.processing');
      case 'completed':
        return t('watermarkRemover.status.completed');
      case 'error':
        return t('watermarkRemover.status.error');
    }
  };

  // Empty state
  if (items.length === 0) {
    return (
      <div className="w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 min-h-[300px] flex items-center justify-center">
        <ResultPlaceholder description={t('watermarkRemover.outputPlaceholder')} />
      </div>
    );
  }

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 flex flex-col gap-4">
      {/* Header with progress and batch actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            {t('watermarkRemover.progress', { completed: completedCount, total: totalCount })}
          </span>
          {isProcessing && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">{progressPercent}%</span>
            </div>
          )}
          {!isProcessing && successCount > 0 && (
            <span className="text-xs text-green-400">
              {t('watermarkRemover.successCount', { count: successCount })}
            </span>
          )}
          {!isProcessing && errorCount > 0 && (
            <span className="text-xs text-red-400">
              {t('watermarkRemover.errorCount', { count: errorCount })}
            </span>
          )}
        </div>

        {/* Batch actions */}
        {successCount > 0 && (
          <div className="flex gap-2">
            <button
              onClick={onSaveAllToGallery}
              className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
            >
              {t('watermarkRemover.saveAll')}
            </button>
            <button
              onClick={handleDownloadAllZip}
              disabled={isDownloadingZip}
              className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isDownloadingZip ? <Spinner /> : t('watermarkRemover.downloadZip')}
            </button>
          </div>
        )}
      </div>

      {/* Grid of items */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="relative bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden"
          >
            {/* Image display */}
            <div className="aspect-square relative">
              <HoverableImage
                image={item.result || item.original}
                altText={item.status === 'completed' ? t('watermarkRemover.resultAlt') : t('watermarkRemover.originalAlt')}
                downloadPrefix={Feature.WatermarkRemover}
              />

              {/* Status overlay for non-completed items */}
              {item.status !== 'completed' && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                  {getStatusIcon(item.status)}
                  <span className="text-xs text-zinc-300">{getStatusText(item.status)}</span>
                  {item.status === 'error' && item.error && (
                    <span className="text-xs text-red-400 px-2 text-center line-clamp-2">
                      {item.error}
                    </span>
                  )}
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => onRemoveItem(item.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs transition-colors"
                title={t('common.remove')}
              >
                ✕
              </button>
            </div>

            {/* Item actions */}
            <div className="p-2 flex items-center justify-between gap-1">
              {item.status === 'completed' && item.result && (
                <>
                  <button
                    onClick={() => onSaveToGallery(item)}
                    className="flex-1 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    onClick={() => onDownloadItem(item)}
                    className="flex-1 px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
                  >
                    {t('common.download')}
                  </button>
                </>
              )}

              {item.status === 'error' && (
                <div className="relative flex-1">
                  <button
                    onClick={() => handleRetryClick(item.id)}
                    className="w-full px-2 py-1 text-xs bg-red-600/50 hover:bg-red-600 text-white rounded transition-colors"
                  >
                    {t('common.retry')} ▾
                  </button>

                  {/* Retry prompt dropdown */}
                  {retryDropdown?.itemId === item.id && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10 overflow-hidden">
                      {WATERMARK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt.id}
                          onClick={() => handleRetryWithPrompt(item.id, prompt.id)}
                          className="w-full px-3 py-2 text-xs text-left text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                          {t(prompt.labelKey)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {item.status === 'pending' && (
                <span className="text-xs text-zinc-500 w-full text-center">
                  {t('watermarkRemover.queued')}
                </span>
              )}

              {item.status === 'processing' && (
                <span className="text-xs text-amber-400 w-full text-center">
                  {t('watermarkRemover.processing')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

WatermarkRemoverOutput.displayName = 'WatermarkRemoverOutput';
