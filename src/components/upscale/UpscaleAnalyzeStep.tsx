/**
 * UpscaleAnalyzeStep — AI Studio Analyze step content.
 *
 * Integrates the analysis trigger button, loading state,
 * the analysis report card, and the prompt package display.
 *
 * Does not own any state — receives everything from the parent hook.
 */

import React from 'react';
import type { UpscaleAnalysisReport } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import Spinner from '../Spinner';
import UpscaleAnalysisReportCard from './UpscaleAnalysisReportCard';
import UpscalePromptPackage from './UpscalePromptPackage';

interface UpscaleAnalyzeStepProps {
  /** Whether an image is selected */
  hasActiveImage: boolean;
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Analysis error message (null = no error) */
  analysisError: string | null;
  /** The analysis report for the active image (null = not yet analyzed) */
  analysisReport: UpscaleAnalysisReport | null | undefined;
  /** The generated prompt for the active image (null = not yet generated) */
  studioPrompt: string | null | undefined;
  /** Trigger analysis on the active image */
  onAnalyze: () => void;
  /** Clear analysis error */
  onClearError: () => void;
}

const UpscaleAnalyzeStep: React.FC<UpscaleAnalyzeStepProps> = ({
  hasActiveImage,
  isAnalyzing,
  analysisError,
  analysisReport,
  studioPrompt,
  onAnalyze,
  onClearError,
}) => {
  const { t } = useLanguage();
  const hasReport = !!analysisReport;

  return (
    <div className="space-y-4">
      {/* Upload prompt when no image */}
      {!hasActiveImage && (
        <div className="bg-zinc-800/30 rounded-xl border border-zinc-800 p-6 text-center">
          <p className="text-zinc-500 text-sm">{t('upscale.analyzeNoImage')}</p>
        </div>
      )}

      {/* Analyze button */}
      {hasActiveImage && (
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
            isAnalyzing
              ? 'bg-zinc-700/50 text-zinc-400 cursor-wait'
              : hasReport
                ? 'bg-zinc-700/60 border border-zinc-600/50 text-zinc-300 hover:bg-zinc-700'
                : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg hover:shadow-violet-500/25 hover:opacity-90'
          }`}
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-4 w-4 border-white" />
              {t('upscale.analyzingStatus')}
            </span>
          ) : hasReport ? (
            <>🔄 {t('upscale.reanalyzeConfirmYes')}</>
          ) : (
            <>🔍 {t('upscale.analyzeButton')}</>
          )}
        </button>
      )}

      {/* Error display */}
      {analysisError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
          <span className="text-red-400 text-base mt-0.5">⚠</span>
          <div className="flex-1">
            <p className="text-sm text-red-400">{analysisError}</p>
          </div>
          <button
            onClick={onClearError}
            className="text-red-400/60 hover:text-red-400 text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Report card */}
      {hasReport && analysisReport && <UpscaleAnalysisReportCard report={analysisReport} />}

      {/* Prompt package */}
      {hasReport && <UpscalePromptPackage prompt={studioPrompt ?? null} />}
    </div>
  );
};

export default UpscaleAnalyzeStep;
