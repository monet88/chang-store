/**
 * UpscaleQuickPanel — Controls for the Quick Upscale lane.
 *
 * Shows:
 * - Quality selector (2K / 4K)
 * - Model selector (Flash / Pro)
 * - Context-aware upscale button
 * - Image uploader when no active image exists
 *
 * Wired to the active image's quality/model settings and the hook's upscale action.
 */

import React from 'react';
import ImageUploader from '../ImageUploader';
import Spinner from '../Spinner';
import {
  ImageFile,
  UpscaleQuality,
  UpscaleQuickModel,
  UPSCALE_QUALITIES,
  UPSCALE_QUICK_MODELS,
  UPSCALE_QUICK_MODEL_LABELS,
} from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpscaleQuickPanelProps {
  /** The currently active original image (null = nothing uploaded yet) */
  activeOriginal: ImageFile | null;
  /** Whether an upscale result exists for the active image */
  hasResult: boolean;
  /** Quality setting for the active image */
  quality: UpscaleQuality;
  /** Model setting for the active image */
  model: UpscaleQuickModel;
  /** Update quality callback */
  onQualityChange: (quality: UpscaleQuality) => void;
  /** Update model callback */
  onModelChange: (model: UpscaleQuickModel) => void;
  /** Request upscale — goes through confirmation if needed */
  onRequestUpscale: () => void;
  /** Upload handler for initial image */
  onImageUpload: (image: ImageFile) => void;
  /** Loading state */
  isLoading: boolean;
}

const QUALITY_LABELS: Record<UpscaleQuality, string> = {
  '2K': '2K (2048px)',
  '4K': '4K (4096px)',
};

const UpscaleQuickPanel: React.FC<UpscaleQuickPanelProps> = ({
  activeOriginal,
  hasResult,
  quality,
  model,
  onQualityChange,
  onModelChange,
  onRequestUpscale,
  onImageUpload,
  isLoading,
}) => {
  const { t } = useLanguage();
  const modelLabel = UPSCALE_QUICK_MODEL_LABELS[model];

  return (
    <div className="flex flex-col gap-5">
      {/* Image uploader — shown when no images in session */}
      {!activeOriginal && (
        <ImageUploader
          image={null}
          id="upscale-quick-upload"
          title={t('upscale.uploadTitle')}
          onImageUpload={onImageUpload}
        />
      )}

      {/* Quality and model selectors */}
      {activeOriginal && (
        <>
          {/* Quality selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              {t('upscale.qualityLabel')}
            </label>
            <div className="flex gap-2">
              {UPSCALE_QUALITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => onQualityChange(q)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    quality === q
                      ? 'border border-white/60 bg-zinc-100 text-zinc-950'
                      : 'border border-transparent bg-zinc-800 text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                  }`}
                >
                  {QUALITY_LABELS[q]}
                </button>
              ))}
            </div>
          </div>

          {/* Model selector — compact inline */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              {t('upscale.modelLabel')}
            </label>
            <div className="flex gap-2">
              {UPSCALE_QUICK_MODELS.map((m) => (
                <button
                  key={m}
                  onClick={() => onModelChange(m)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    model === m
                      ? 'border border-white/60 bg-zinc-100 text-zinc-950'
                      : 'border border-transparent bg-zinc-800 text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
                  }`}
                >
                  {UPSCALE_QUICK_MODEL_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Upscale button — context-aware text */}
          <div className="text-center">
            <button
              onClick={onRequestUpscale}
              disabled={isLoading}
              className="workspace-button workspace-button-primary px-8 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Spinner />
              ) : hasResult ? (
                t('upscale.reupscaleButton', { quality, model: modelLabel })
              ) : (
                t('upscale.generateButton')
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UpscaleQuickPanel;
