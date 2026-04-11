/**
 * UpscaleStudioStepShell — Visible AI Studio step header with routed content.
 *
 * Phase 4 evolution: Routes to UpscaleAnalyzeStep (Analyze) and
 * UpscaleEnhanceStep (Enhance). Export remains a "coming soon" placeholder.
 *
 * Does not own step state — receives current step and navigation callback from parent.
 */

import React from 'react';
import { UpscaleStudioStep } from '../../types';
import type { ImageFile, UpscaleAnalysisReport, StudioSupportStatus } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import UpscaleAnalyzeStep from './UpscaleAnalyzeStep';
import UpscaleEnhanceStep from './UpscaleEnhanceStep';

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
  // ---- Phase 4 Enhance props ----
  isStudioUpscaling?: boolean;
  studioUpscaleError?: string | null;
  studioSupportStatus?: StudioSupportStatus;
  studioPreview?: string | null;
  studioResult?: ImageFile | null;
  onStudioUpscale?: () => void;
  onClearStudioUpscaleError?: () => void;
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
  isStudioUpscaling = false,
  studioUpscaleError = null,
  studioSupportStatus = 'supported',
  studioPreview,
  studioResult,
  onStudioUpscale,
  onClearStudioUpscaleError,
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
        return (
          <UpscaleEnhanceStep
            hasActiveImage={hasActiveImage}
            hasAnalysisReport={!!analysisReport}
            studioPrompt={studioPrompt ?? null}
            studioPreview={studioPreview ?? null}
            studioResult={studioResult ?? null}
            studioSupportStatus={studioSupportStatus}
            isStudioUpscaling={isStudioUpscaling}
            studioUpscaleError={studioUpscaleError}
            onUpscale={onStudioUpscale ?? (() => {})}
            onClearError={onClearStudioUpscaleError ?? (() => {})}
          />
        );

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
                  ? 'border border-white/60 bg-zinc-100 text-zinc-950'
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
