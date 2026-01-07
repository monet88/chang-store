# Phase 3: Components

**Estimated**: 3 hours

## Tasks

### 3.1 Create components/WatermarkRemoverOutput.tsx

```typescript
/**
 * Watermark Remover Output Grid
 * 
 * Displays batch processing results with per-item status,
 * inline retry dropdown, and download options.
 */
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { WATERMARK_PROMPTS } from '@/utils/watermark-prompts';
import type { WatermarkBatchItem } from '@/types';
import Spinner from './Spinner';

interface WatermarkRemoverOutputProps {
  items: WatermarkBatchItem[];
  isProcessing: boolean;
  onRetry: (id: string, promptId?: string) => void;
  onSave: (item: WatermarkBatchItem) => void;
  onDownload: (item: WatermarkBatchItem) => void;
  onSaveAll: () => void;
  onDownloadAll: () => void;
  successCount: number;
}

export function WatermarkRemoverOutput({
  items,
  isProcessing,
  onRetry,
  onSave,
  onDownload,
  onSaveAll,
  onDownloadAll,
  successCount,
}: WatermarkRemoverOutputProps) {
  const { t } = useLanguage();

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        {t('watermarkRemover.noImages')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Batch actions */}
      {successCount > 0 && (
        <div className="flex gap-2 justify-end">
          <button
            onClick={onSaveAll}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {t('watermarkRemover.saveAll')} ({successCount})
          </button>
          <button
            onClick={onDownloadAll}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('watermarkRemover.downloadZip')}
          </button>
        </div>
      )}

      {/* Items grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <WatermarkOutputItem
            key={item.id}
            item={item}
            onRetry={onRetry}
            onSave={onSave}
            onDownload={onDownload}
          />
        ))}
      </div>
    </div>
  );
}

/** Single output item with status and actions */
function WatermarkOutputItem({
  item,
  onRetry,
  onSave,
  onDownload,
}: {
  item: WatermarkBatchItem;
  onRetry: (id: string, promptId?: string) => void;
  onSave: (item: WatermarkBatchItem) => void;
  onDownload: (item: WatermarkBatchItem) => void;
}) {
  const { t } = useLanguage();
  const [retryPromptId, setRetryPromptId] = useState('');

  const handleRetry = () => {
    onRetry(item.id, retryPromptId || undefined);
    setRetryPromptId('');
  };

  return (
    <div className="border rounded-lg p-2 bg-white shadow-sm">
      {/* Image preview */}
      <div className="relative aspect-square mb-2">
        <img
          src={item.result?.data || item.original.data}
          alt={item.original.name}
          className="w-full h-full object-cover rounded"
        />
        
        {/* Status overlay */}
        {item.status === 'processing' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
            <div className="text-white text-center">
              <Spinner />
              <div className="mt-1 text-sm">{item.progress}%</div>
            </div>
          </div>
        )}
        
        {item.status === 'error' && (
          <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center rounded">
            <span className="text-white text-2xl">!</span>
          </div>
        )}
        
        {item.status === 'success' && (
          <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
            OK
          </div>
        )}
      </div>

      {/* Status text */}
      <div className="text-xs text-gray-600 truncate mb-2">
        {item.original.name}
      </div>

      {/* Actions based on status */}
      {item.status === 'success' && (
        <div className="flex gap-1">
          <button
            onClick={() => onSave(item)}
            className="flex-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
            title={t('watermarkRemover.save')}
          >
            Save
          </button>
          <button
            onClick={() => onDownload(item)}
            className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            title={t('watermarkRemover.download')}
          >
            DL
          </button>
        </div>
      )}

      {item.status === 'error' && (
        <div className="space-y-1">
          <div className="text-xs text-red-600 truncate" title={item.error}>
            {item.error}
          </div>
          <div className="flex gap-1">
            <select
              value={retryPromptId}
              onChange={e => setRetryPromptId(e.target.value)}
              className="flex-1 text-xs border rounded px-1 py-1"
            >
              <option value="">{t('watermarkRemover.samePrompt')}</option>
              {WATERMARK_PROMPTS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleRetry}
              className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {item.status === 'pending' && (
        <div className="text-xs text-gray-400 text-center py-1">
          {t('watermarkRemover.pending')}
        </div>
      )}
    </div>
  );
}

export default WatermarkRemoverOutput;
```

### 3.2 Create components/WatermarkRemover.tsx

```typescript
/**
 * Watermark Remover - Main Feature Component
 * 
 * Batch remove text, logos, and watermarks from images
 * using Gemini AI with configurable prompts and concurrency.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { useImageGallery } from '@/contexts/ImageGalleryContext';
import { useWatermarkRemover } from '@/hooks/useWatermarkRemover';
import { WATERMARK_MODELS, WATERMARK_PROMPTS, getPromptText } from '@/utils/watermark-prompts';
import MultiImageUploader from './MultiImageUploader';
import WatermarkRemoverOutput from './WatermarkRemoverOutput';

export function WatermarkRemover() {
  const { t } = useLanguage();
  const { addImage } = useImageGallery();
  
  const {
    items,
    isProcessing,
    config,
    setModel,
    setPromptId,
    setCustomPrompt,
    setConcurrency,
    addImages,
    clearAll,
    startProcessing,
    retryItem,
    saveToGallery,
    saveAllToGallery,
    downloadItem,
    downloadAllZip,
    successItems,
  } = useWatermarkRemover(addImage);

  // Get current prompt text for display
  const currentPromptText = config.promptId === 'custom' 
    ? config.customPrompt 
    : getPromptText(config.promptId as any);

  const canStart = items.length > 0 && !isProcessing && items.some(i => i.status === 'pending');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      {/* Left column - Inputs */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">{t('watermarkRemover.title')}</h2>
          <p className="text-gray-600 text-sm">{t('watermarkRemover.description')}</p>
        </div>

        {/* Image uploader */}
        <MultiImageUploader
          images={items.map(i => i.original)}
          onImagesUpload={addImages}
          title={t('watermarkRemover.uploadImages')}
          id="watermark-uploader"
        />

        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-red-600 hover:text-red-800"
          >
            {t('watermarkRemover.clearAll')}
          </button>
        )}

        {/* Model selection */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('watermarkRemover.selectModel')}
          </label>
          <select
            value={config.model}
            onChange={e => setModel(e.target.value as any)}
            className="w-full border rounded px-3 py-2"
            disabled={isProcessing}
          >
            {WATERMARK_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Prompt selection */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('watermarkRemover.selectPrompt')}
          </label>
          <select
            value={config.promptId}
            onChange={e => setPromptId(e.target.value as any)}
            className="w-full border rounded px-3 py-2"
            disabled={isProcessing}
          >
            {WATERMARK_PROMPTS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="custom">{t('watermarkRemover.customPrompt')}</option>
          </select>
        </div>

        {/* Prompt textarea */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('watermarkRemover.prompt')}
          </label>
          <textarea
            value={config.promptId === 'custom' ? config.customPrompt : currentPromptText}
            onChange={e => {
              if (config.promptId === 'custom') {
                setCustomPrompt(e.target.value);
              } else {
                // Switch to custom when editing predefined
                setPromptId('custom');
                setCustomPrompt(e.target.value);
              }
            }}
            className="w-full border rounded px-3 py-2 h-24 resize-none"
            disabled={isProcessing}
            placeholder={t('watermarkRemover.promptPlaceholder')}
          />
        </div>

        {/* Concurrency */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('watermarkRemover.concurrency')} ({config.concurrency})
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={config.concurrency}
            onChange={e => setConcurrency(parseInt(e.target.value))}
            className="w-full"
            disabled={isProcessing}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={startProcessing}
          disabled={!canStart}
          className={`w-full py-3 rounded font-medium ${
            canStart
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isProcessing 
            ? t('watermarkRemover.processing') 
            : t('watermarkRemover.startProcessing')
          }
        </button>
      </div>

      {/* Right column - Output */}
      <div>
        <WatermarkRemoverOutput
          items={items}
          isProcessing={isProcessing}
          onRetry={retryItem}
          onSave={saveToGallery}
          onDownload={downloadItem}
          onSaveAll={saveAllToGallery}
          onDownloadAll={downloadAllZip}
          successCount={successItems.length}
        />
      </div>
    </div>
  );
}

export default WatermarkRemover;
```

## Checklist

- [ ] Create `components/WatermarkRemoverOutput.tsx`
- [ ] Create `components/WatermarkRemover.tsx`
- [ ] Verify component renders without errors
- [ ] Test image upload flow
