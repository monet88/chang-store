/**
 * WatermarkRemover - Batch watermark removal component
 *
 * Features:
 * - Upload multiple images for batch processing
 * - Select AI model and prompt presets
 * - Concurrent processing with configurable concurrency
 * - Progress tracking per image with status indicators
 * - Retry failed items, save to gallery, download as ZIP
 */

import React, { useCallback, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useWatermarkRemover } from '../hooks/useWatermarkRemover';
import { WATERMARK_MODELS, WATERMARK_PROMPTS } from '../utils/watermark-prompts';
import MultiImageUploader from './MultiImageUploader';
import Spinner from './Spinner';
import ResultPlaceholder from './shared/ResultPlaceholder';
import { ImageFile, WatermarkBatchItem } from '../types';
import {
  DeleteIcon,
  DownloadIcon,
  GalleryIcon,
  RegenerateIcon,
} from './Icons';

/**
 * Status badge component for individual batch items
 */
const StatusBadge: React.FC<{ status: WatermarkBatchItem['status']; error?: string }> = ({
  status,
  error,
}) => {
  const { t } = useLanguage();

  const statusConfig = {
    pending: {
      bg: 'bg-zinc-600',
      text: t('watermarkRemover.status.pending'),
    },
    processing: {
      bg: 'bg-amber-600',
      text: t('watermarkRemover.status.processing'),
    },
    completed: {
      bg: 'bg-green-600',
      text: t('watermarkRemover.status.completed'),
    },
    error: {
      bg: 'bg-red-600',
      text: t('watermarkRemover.status.error'),
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`${config.bg} text-white text-xs px-2 py-0.5 rounded-full font-medium`}
      >
        {config.text}
      </span>
      {status === 'error' && error && (
        <span className="text-red-400 text-xs truncate max-w-[150px]" title={error}>
          {error}
        </span>
      )}
    </div>
  );
};

/**
 * Individual batch item card showing original/result with actions
 */
const BatchItemCard: React.FC<{
  item: WatermarkBatchItem;
  index: number;
  onRetry: (promptId?: string) => void;
  onRemove: () => void;
  onSave: () => void;
  onDownload: () => void;
  isProcessing: boolean;
}> = ({ item, index, onRetry, onRemove, onSave, onDownload, isProcessing }) => {
  const { t } = useLanguage();
  const [retryPromptId, setRetryPromptId] = useState('');

  const handleRetry = () => {
    onRetry(retryPromptId || undefined);
    setRetryPromptId('');
  };

  return (
    <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-3 flex flex-col gap-3">
      {/* Header with index and status */}
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-sm font-medium">
          #{index + 1}
        </span>
        <StatusBadge status={item.status} error={item.error} />
      </div>

      {/* Images: Original → Result */}
      <div className="grid grid-cols-2 gap-2">
        {/* Original image */}
        <div className="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700">
          <img
            src={`data:${item.original.mimeType};base64,${item.original.base64}`}
            alt={t('watermarkRemover.originalAlt', { index: index + 1 })}
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-1 left-1 bg-black/70 text-zinc-400 text-xs px-1.5 py-0.5 rounded">
            {t('watermarkRemover.original')}
          </div>
        </div>

        {/* Result image or placeholder */}
        <div className="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700">
          {item.status === 'processing' ? (
            <div className="w-full h-full flex items-center justify-center">
              <Spinner />
            </div>
          ) : item.result ? (
            <>
              <img
                src={`data:${item.result.mimeType};base64,${item.result.base64}`}
                alt={t('watermarkRemover.resultAlt', { index: index + 1 })}
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-1 left-1 bg-black/70 text-green-400 text-xs px-1.5 py-0.5 rounded">
                {t('watermarkRemover.result')}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <span className="text-xs text-center px-2">
                {item.status === 'error'
                  ? t('watermarkRemover.failed')
                  : t('watermarkRemover.pending')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {/* Retry/Regenerate with prompt selector (for error and completed) */}
        {(item.status === 'error' || item.status === 'completed') && (
          <div className="flex items-center gap-1">
            <select
              value={retryPromptId}
              onChange={(e) => setRetryPromptId(e.target.value)}
              disabled={isProcessing}
              className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
            >
              <option value="">{t('watermarkRemover.samePrompt')}</option>
              {WATERMARK_PROMPTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {t(`watermarkRemover.${p.labelKey}`)}
                </option>
              ))}
            </select>
            <button
              onClick={handleRetry}
              disabled={isProcessing}
              className="p-1.5 bg-amber-600/80 hover:bg-amber-500 rounded text-white transition-colors disabled:opacity-50"
              title={t('watermarkRemover.retry')}
            >
              <RegenerateIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action buttons row */}
        <div className="flex items-center justify-end gap-2">
          {/* Save to gallery (only for completed) */}
          {item.status === 'completed' && item.result && (
            <button
              onClick={onSave}
              className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-white transition-colors"
              title={t('imageActions.saveToGallery')}
            >
              <GalleryIcon className="w-4 h-4" />
            </button>
          )}

          {/* Download (only for completed) */}
          {item.status === 'completed' && item.result && (
            <button
              onClick={onDownload}
              className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-white transition-colors"
              title={t('imageActions.download')}
            >
              <DownloadIcon className="w-4 h-4" />
            </button>
          )}

          {/* Remove button */}
          <button
            onClick={onRemove}
            disabled={isProcessing && item.status === 'processing'}
            className="p-1.5 bg-red-600/70 hover:bg-red-500 rounded text-white transition-colors disabled:opacity-50"
            title={t('watermarkRemover.remove')}
          >
            <DeleteIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Main WatermarkRemover component
 */
const WatermarkRemover: React.FC = () => {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();

  // Initialize hook with gallery save callback
  const {
    items,
    isProcessing,
    config,
    setModel,
    setPromptId,
    setCustomPrompt,
    setConcurrency,
    addImages,
    removeImage,
    clearAll,
    startProcessing,
    retryItem,
    saveToGallery,
    saveAllToGallery,
    downloadItem,
    downloadAllZip,
    completedCount,
    totalCount,
    successItems,
    pendingCount,
    errorCount,
  } = useWatermarkRemover(addImage);

  // Handle multi-image upload
  const handleImagesUpload = useCallback(
    (images: ImageFile[]) => {
      // Extract only the new images (the uploader passes all images including existing)
      const existingCount = items.length;
      const newImages = images.slice(existingCount);
      if (newImages.length > 0) {
        addImages(newImages);
      }
    },
    [items.length, addImages]
  );

  // Get original images for the MultiImageUploader display
  const originalImages = items.map((item) => item.original);

  // Helper to find item by id and call action
  const handleSaveItem = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item) saveToGallery(item);
  }, [items, saveToGallery]);

  const handleDownloadItem = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item) downloadItem(item);
  }, [items, downloadItem]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
      {/* Left Panel: Inputs */}
      <div className="flex flex-col gap-6">
        {/* Upload Section */}
        <section className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
          <h2 className="text-lg font-semibold text-white mb-4">
            {t('watermarkRemover.title')}
          </h2>
          <p className="text-zinc-400 text-sm mb-4">
            {t('watermarkRemover.description')}
          </p>

          <MultiImageUploader
            images={originalImages}
            onImagesUpload={handleImagesUpload}
            title={t('watermarkRemover.uploadTitle')}
            id="watermark-uploader"
          />

          {items.length > 0 && (
            <button
              onClick={clearAll}
              disabled={isProcessing}
              className="mt-3 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              {t('watermarkRemover.clearAll')}
            </button>
          )}
        </section>

        {/* Configuration Section */}
        <section className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-md font-medium text-white mb-4">
            {t('watermarkRemover.settings')}
          </h3>

          {/* Model Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              {t('watermarkRemover.modelLabel')}
            </label>
            <select
              value={config.model}
              onChange={(e) => setModel(e.target.value as typeof WATERMARK_MODELS[number]['id'])}
              disabled={isProcessing}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              {WATERMARK_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Preset Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              {t('watermarkRemover.promptLabel')}
            </label>
            <select
              value={config.promptId}
              onChange={(e) => setPromptId(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              {WATERMARK_PROMPTS.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {t(prompt.labelKey)}
                </option>
              ))}
              <option value="custom">{t('watermarkRemover.prompts.custom')}</option>
            </select>
          </div>

          {/* Custom Prompt (when 'custom' is selected) */}
          {config.promptId === 'custom' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('watermarkRemover.customPromptLabel')}
              </label>
              <textarea
                value={config.customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                disabled={isProcessing}
                placeholder={t('watermarkRemover.customPromptPlaceholder')}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[80px] resize-y"
              />
            </div>
          )}

          {/* Concurrency Slider */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              {t('watermarkRemover.concurrencyLabel')}: {config.concurrency}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={config.concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={isProcessing}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>1</span>
              <span>5</span>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="flex flex-col gap-3">
          {/* Start Processing Button */}
          <button
            onClick={startProcessing}
            disabled={isProcessing || items.length === 0 || pendingCount === 0}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Spinner />
                <span>
                  {t('watermarkRemover.processingStatus', {
                    completed: completedCount,
                    total: totalCount,
                  })}
                </span>
              </>
            ) : (
              <span>
                {t('watermarkRemover.startButton', { count: pendingCount })}
              </span>
            )}
          </button>

          {/* Bulk Actions (when there are completed items) */}
          {successItems.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={saveAllToGallery}
                disabled={isProcessing}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <GalleryIcon className="w-4 h-4" />
                <span>{t('watermarkRemover.saveAll')}</span>
              </button>
              <button
                onClick={downloadAllZip}
                disabled={isProcessing}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                <span>{t('watermarkRemover.downloadZip')}</span>
              </button>
            </div>
          )}
        </section>

        {/* Progress Summary */}
        {items.length > 0 && (
          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
            <h3 className="text-md font-medium text-white mb-3">
              {t('watermarkRemover.progressTitle')}
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-zinc-800 rounded p-2">
                <div className="text-xl font-bold text-white">{totalCount}</div>
                <div className="text-xs text-zinc-400">{t('watermarkRemover.total')}</div>
              </div>
              <div className="bg-zinc-800 rounded p-2">
                <div className="text-xl font-bold text-amber-400">{pendingCount}</div>
                <div className="text-xs text-zinc-400">{t('watermarkRemover.pendingCount')}</div>
              </div>
              <div className="bg-zinc-800 rounded p-2">
                <div className="text-xl font-bold text-green-400">{completedCount}</div>
                <div className="text-xs text-zinc-400">{t('watermarkRemover.completedCount')}</div>
              </div>
              <div className="bg-zinc-800 rounded p-2">
                <div className="text-xl font-bold text-red-400">{errorCount}</div>
                <div className="text-xs text-zinc-400">{t('watermarkRemover.errorCount')}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Results Grid */}
      <div>
        <section className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-md font-medium text-white mb-4">
            {t('watermarkRemover.resultsTitle')}
          </h3>

          {items.length === 0 ? (
            <ResultPlaceholder
              title={t('common.outputPanelTitle')}
              description={t('watermarkRemover.outputPanelDescription')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
              {items.map((item, index) => (
                <BatchItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  onRetry={(promptId) => retryItem(item.id, promptId)}
                  onRemove={() => removeImage(item.id)}
                  onSave={() => handleSaveItem(item.id)}
                  onDownload={() => handleDownloadItem(item.id)}
                  isProcessing={isProcessing}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default WatermarkRemover;
