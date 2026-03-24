/**
 * UpscaleGuidanceCard — Gemini-specific execution guidance and recommended next action.
 *
 * Shows a numbered step-by-step guide for the Gemini upscale workflow
 * and adapts the recommended next action based on current state.
 * Displays feature-scoped errors when the provider is unsupported (REL-01).
 */

import React from 'react';
import type { StudioSupportStatus } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpscaleGuidanceCardProps {
  /** Whether an analysis report exists for this image */
  hasReport: boolean;
  /** Whether a studio upscale result exists */
  hasResult: boolean;
  /** Current provider support status */
  studioSupportStatus: StudioSupportStatus;
}

const UpscaleGuidanceCard: React.FC<UpscaleGuidanceCardProps> = ({
  hasReport,
  hasResult,
  studioSupportStatus,
}) => {
  const { t } = useLanguage();

  // Determine recommended next action
  const getNextAction = (): { text: string; icon: string; color: string } => {
    if (hasResult) {
      return { text: t('upscale.guidanceNextDone'), icon: '✅', color: 'text-green-400' };
    }
    if (hasReport) {
      return { text: t('upscale.guidanceNextUpscale'), icon: '🚀', color: 'text-blue-400' };
    }
    return { text: t('upscale.guidanceNextAnalyze'), icon: '🔍', color: 'text-zinc-400' };
  };

  const nextAction = getNextAction();

  // Feature-scoped error for unsupported provider
  if (studioSupportStatus !== 'supported') {
    const errorMessage =
      studioSupportStatus === 'no_api_key'
        ? t('upscale.studioNoApiKey')
        : t('upscale.studioUnsupportedProvider');

    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-400 text-lg">⚠️</span>
          <h4 className="text-sm font-semibold text-red-400">
            {t('upscale.guidanceTitle')}
          </h4>
        </div>
        <p className="text-sm text-red-300">{errorMessage}</p>
      </div>
    );
  }

  const steps = [
    t('upscale.guidanceStep1'),
    t('upscale.guidanceStep2'),
    t('upscale.guidanceStep3'),
    t('upscale.guidanceStep4'),
  ];

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue-400 text-lg">📋</span>
        <h4 className="text-sm font-semibold text-zinc-200">
          {t('upscale.guidanceTitle')}
        </h4>
      </div>

      {/* Numbered steps */}
      <ol className="space-y-2 mb-4">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center font-medium mt-0.5">
              {index + 1}
            </span>
            <span className="text-sm text-zinc-400">{step}</span>
          </li>
        ))}
      </ol>

      {/* Recommended next action */}
      <div className="pt-3 border-t border-zinc-700/50">
        <p className={`text-sm font-medium ${nextAction.color}`}>
          {nextAction.icon} {nextAction.text}
        </p>
      </div>
    </div>
  );
};

export default UpscaleGuidanceCard;
