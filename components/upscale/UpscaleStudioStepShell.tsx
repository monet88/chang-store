/**
 * UpscaleStudioStepShell — Visible AI Studio step header with routed content.
 *
 * Phase 3 evolution: Shows the three guided steps (Analyze → Enhance → Export)
 * with the current step highlighted and future steps visually disabled.
 * Routes to the UpscaleAnalyzeStep when on the Analyze step;
 * Enhance/Export show "coming soon" placeholders.
 *
 * Does not own step state — receives current step and navigation callback from parent.
 */

import React from 'react';
import { UpscaleStudioStep } from '../../types';
import type { UpscaleAnalysisReport } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import UpscaleAnalyzeStep from './UpscaleAnalyzeStep';

interface UpscaleStudioStepShellProps {
  currentStep: UpscaleStudioStep;
  onStepChange: (step: UpscaleStudioStep) => void;
  hasActiveImage: boolean;
  // ---- Phase 3 analysis props ----
  isAnalyzing?: boolean;
  analysisError?: string | null;
  analysisReport?: UpscaleAnalysisReport | null;
  studioPrompt?: string | null;
  onAnalyze?: () => void;
  onClearAnalysisError?: () => void;
}

/** Ordered step definitions */
const STEPS: { value: UpscaleStudioStep; labelKey: string; icon: string; index: number }[] = [
  { value: UpscaleStudioStep.Analyze, labelKey: 'upscale.studioStepAnalyze', icon: '🔍', index: 0 },
  { value: UpscaleStudioStep.Enhance, labelKey: 'upscale.studioStepEnhance', icon: '✨', index: 1 },
  { value: UpscaleStudioStep.Export, labelKey: 'upscale.studioStepExport', icon: '📦', index: 2 },
];

const stepIndex = (step: UpscaleStudioStep): number =>
  STEPS.findIndex((s) => s.value === step);

const UpscaleStudioStepShell: React.FC<UpscaleStudioStepShellProps> = ({
  currentStep,
  onStepChange,
  hasActiveImage,
  isAnalyzing = false,
  analysisError = null,
  analysisReport,
  studioPrompt,
  onAnalyze,
  onClearAnalysisError,
}) => {
  const { t } = useLanguage();
  const currentIdx = stepIndex(currentStep);

  /** Renders the content for the current step */
  const renderStepContent = () => {
    if (!hasActiveImage) {
      return (
        <div className="bg-zinc-800/30 rounded-xl border border-zinc-800 p-6 text-center min-h-[120px] flex items-center justify-center">
          <p className="text-zinc-500 text-sm">
            {t('upscale.studioUploadFirst')}
          </p>
        </div>
      );
    }

    switch (currentStep) {
      case UpscaleStudioStep.Analyze:
        return (
          <UpscaleAnalyzeStep
            hasActiveImage={hasActiveImage}
            isAnalyzing={isAnalyzing}
            analysisError={analysisError}
            analysisReport={analysisReport}
            studioPrompt={studioPrompt}
            onAnalyze={onAnalyze ?? (() => {})}
            onClearError={onClearAnalysisError ?? (() => {})}
          />
        );

      case UpscaleStudioStep.Enhance:
      case UpscaleStudioStep.Export:
      default:
        return (
          <div className="bg-zinc-800/30 rounded-xl border border-zinc-800 p-6 text-center min-h-[120px] flex items-center justify-center">
            <div className="text-zinc-400">
              <p className="text-sm font-medium mb-1">
                {t(`upscale.studioStep${currentStep.charAt(0).toUpperCase() + currentStep.slice(1)}`)}
              </p>
              <p className="text-xs text-zinc-600">
                {t('upscale.studioComingSoon')}
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Step header bar */}
      <div className="flex items-center gap-1 bg-zinc-800/40 rounded-xl p-1.5">
        {STEPS.map((step) => {
          const isCurrent = step.value === currentStep;
          const isLocked = step.index > currentIdx;
          const isCompleted = step.index < currentIdx;

          return (
            <button
              key={step.value}
              onClick={() => {
                if (!isLocked) onStepChange(step.value);
              }}
              disabled={isLocked || !hasActiveImage}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                isCurrent
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                  : isCompleted
                    ? 'text-emerald-400 hover:bg-zinc-700/50 cursor-pointer'
                    : 'text-zinc-600 cursor-not-allowed'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span className="text-base">{isCompleted ? '✓' : step.icon}</span>
              <span className="hidden sm:inline">{t(step.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Step content — routed by current step */}
      {renderStepContent()}
    </div>
  );
};

export default UpscaleStudioStepShell;
