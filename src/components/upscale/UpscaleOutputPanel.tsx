/**
 * UpscaleOutputPanel — Shared sticky output panel for the Upscale workspace.
 *
 * Renders the appropriate output based on workspace state:
 * - Loading spinner with message
 * - Error display with actionable suggestion
 * - Before/After comparison (Quick Upscale result) + metadata + glow
 * - Result placeholder (nothing to show yet)
 *
 * Shared between Quick Upscale and AI Studio — both lanes write results
 * that this panel displays.
 */

import React, { useMemo } from 'react';
import ImageComparator from '../ImageComparator';
import Spinner, { ErrorDisplay } from '../Spinner';
import ResultPlaceholder from '../shared/ResultPlaceholder';
import { Feature, ImageFile, UpscaleQuality, UpscaleQuickModel, UPSCALE_QUICK_MODEL_LABELS } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpscaleOutputPanelProps {
  /** Original image (before) */
  original: ImageFile | null;
  /** Upscaled result (after) */
  result: ImageFile | null;
  /** Quality setting used for this result */
  quality?: UpscaleQuality;
  /** Model setting used for this result */
  model?: UpscaleQuickModel;
  /** Loading indicator */
  isLoading: boolean;
  /** Loading message */
  loadingMessage: string;
  /** Error to display */
  error: string | null;
  /** Actionable suggestion for the error */
  errorSuggestion?: string | null;
  /** Whether to show glow animation */
  showGlow?: boolean;
  /** Clear error callback */
  onClearError: () => void;
}

/** Estimate base64 image size in KB */
const estimateBase64SizeKB = (base64: string): number =>
  Math.round((base64.length * 3) / 4 / 1024);

const UpscaleOutputPanel: React.FC<UpscaleOutputPanelProps> = ({
  original,
  result,
  quality,
  model,
  isLoading,
  loadingMessage,
  error,
  errorSuggestion,
  showGlow = false,
  onClearError,
}) => {
  const { t } = useLanguage();

  /** Metadata pills for result */
  const resultMeta = useMemo(() => {
    if (!result) return null;
    const sizeKB = estimateBase64SizeKB(result.base64);
    const modelLabel = model ? UPSCALE_QUICK_MODEL_LABELS[model] : '';
    return { sizeKB, modelLabel };
  }, [result, model]);

  // Glow ring class
  const glowRingClass = showGlow
    ? 'ring-2 ring-amber-400/60 shadow-[0_0_30px_rgba(251,191,36,0.3)]'
    : '';

  return (
    <div
      className={`relative w-full h-full min-h-[50vh] bg-zinc-900/50 rounded-2xl border border-zinc-800 grid place-items-center p-2 sm:p-4 transition-all duration-700 ${glowRingClass}`}
    >
      {isLoading ? (
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-zinc-400">{loadingMessage}</p>
        </div>
      ) : error ? (
        <div className="p-4">
          <ErrorDisplay
            title={t('common.generationFailed')}
            message={error}
            onClear={onClearError}
          />
          {errorSuggestion && (
            <p className="mt-3 text-sm text-amber-400/80 text-center italic">
              💡 {errorSuggestion}
            </p>
          )}
        </div>
      ) : result && original ? (
        <div className="w-full h-full flex flex-col gap-4 absolute inset-0 p-4">
          <h3 className="text-xl font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
            {t('upscale.comparisonTitle')}
          </h3>

          {/* Metadata strip */}
          {resultMeta && (
            <div className="flex items-center justify-center gap-4 text-xs text-zinc-400">
              {quality && (
                <span>
                  {t('upscale.metadata.resolution')}: <strong className="text-zinc-200">{quality}</strong>
                </span>
              )}
              {resultMeta.modelLabel && (
                <span>
                  {t('upscale.modelLabel')}: <strong className="text-zinc-200">{resultMeta.modelLabel}</strong>
                </span>
              )}
              <span>
                {t('upscale.metadata.fileSize')}: <strong className="text-zinc-200">{resultMeta.sizeKB} KB</strong>
              </span>
            </div>
          )}

          <div className="flex-grow relative">
            <ImageComparator before={original} after={result} downloadPrefix={Feature.Upscale} />
          </div>
        </div>
      ) : (
        <ResultPlaceholder description={t('upscale.outputPanelDescription')} />
      )}
    </div>
  );
};

export default UpscaleOutputPanel;
