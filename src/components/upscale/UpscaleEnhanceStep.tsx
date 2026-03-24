/**
 * UpscaleEnhanceStep — Orchestrates the Enhance step of the AI Studio pipeline.
 *
 * Composes: guidance card → preview simulation → upscale button → result indicator.
 * Handles loading, error, and disabled states for the inline studio upscale.
 */

import React from 'react';
import type { ImageFile, StudioSupportStatus } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import UpscaleGuidanceCard from './UpscaleGuidanceCard';
import UpscalePreviewSimulation from './UpscalePreviewSimulation';

interface UpscaleEnhanceStepProps {
  /** Whether there is an active image in the session */
  hasActiveImage: boolean;
  /** Whether an analysis report has been generated */
  hasAnalysisReport: boolean;
  /** The AI-generated prompt (null if analysis not run) */
  studioPrompt: string | null | undefined;
  /** The simulated preview text (null if analysis not run) */
  studioPreview: string | null | undefined;
  /** The studio upscale result (null until upscaled) */
  studioResult: ImageFile | null | undefined;
  /** Provider support status */
  studioSupportStatus: StudioSupportStatus;
  /** Whether a studio upscale is currently running */
  isStudioUpscaling: boolean;
  /** Error from the studio upscale (null = no error) */
  studioUpscaleError: string | null;
  /** Callback to trigger the studio upscale */
  onUpscale: () => void;
  /** Callback to clear the studio upscale error */
  onClearError: () => void;
}

const UpscaleEnhanceStep: React.FC<UpscaleEnhanceStepProps> = ({
  hasActiveImage,
  hasAnalysisReport,
  studioPrompt,
  studioPreview,
  studioResult,
  studioSupportStatus,
  isStudioUpscaling,
  studioUpscaleError,
  onUpscale,
  onClearError,
}) => {
  const { t } = useLanguage();

  const canUpscale =
    hasActiveImage &&
    hasAnalysisReport &&
    !!studioPrompt &&
    studioSupportStatus === 'supported' &&
    !isStudioUpscaling;

  return (
    <div className="space-y-4">
      {/* Guidance card */}
      <UpscaleGuidanceCard
        hasReport={hasAnalysisReport}
        hasResult={!!studioResult}
        studioSupportStatus={studioSupportStatus}
      />

      {/* Preview simulation */}
      <UpscalePreviewSimulation preview={studioPreview ?? null} />

      {/* Error display */}
      {studioUpscaleError && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 flex items-center justify-between">
          <p className="text-sm text-red-300">{studioUpscaleError}</p>
          <button
            onClick={onClearError}
            className="text-red-400 hover:text-red-300 text-xs font-medium ml-3 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upscale trigger button */}
      {!studioResult && (
        <button
          onClick={onUpscale}
          disabled={!canUpscale}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
            canUpscale
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 hover:shadow-lg hover:shadow-blue-500/25'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {isStudioUpscaling ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              {t('upscale.enhancingStatus')}
            </span>
          ) : !hasAnalysisReport ? (
            t('upscale.enhanceNoPrompt')
          ) : (
            t('upscale.enhanceButton')
          )}
        </button>
      )}

      {/* Result indicator */}
      {studioResult && (
        <div className="rounded-xl border border-green-500/30 bg-green-950/20 p-3 text-center">
          <p className="text-sm font-semibold text-green-400">
            ✅ {t('upscale.enhanceComplete')}
          </p>
        </div>
      )}
    </div>
  );
};

export default UpscaleEnhanceStep;
