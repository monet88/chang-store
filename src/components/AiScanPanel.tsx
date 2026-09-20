import React, { useEffect, useState } from 'react';
import { useAiScan } from '../contexts/AiScanContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { ImageFile } from '../types';
import Spinner from './Spinner';

interface AiScanPanelProps {
  /**
   * Source images the scan deconstructs — the garments, models and scenes the
   * feature is about to generate from.
   */
  sources: ImageFile[];
}

/** What this panel shows: the analysis of its OWN source set. */
interface PanelReport {
  blueprint: string | null;
  isAnalyzing: boolean;
  failed: boolean;
}

const IDLE_REPORT: PanelReport = { blueprint: null, isAnalyzing: false, failed: false };

/**
 * AI Scan control (issue #162): the ON/OFF switch, the status badge, and the
 * expandable technical blueprint viewer. Rendered in a feature's action bar;
 * the analysis itself is owned by `AiScanContext` and consumed again at
 * generation time, so the panel never has to hand the blueprint on.
 *
 * The badge state is the panel's own, never the provider's: a batch scans one
 * source set per job (Virtual Try-On multi-model, wardrobe, Identity Transfer),
 * so another job's blueprint, spinner or failure must not surface here.
 */
const AiScanPanel: React.FC<AiScanPanelProps> = ({ sources }) => {
  const { t } = useLanguage();
  const { enabled, setEnabled, scan } = useAiScan();
  const [isExpanded, setIsExpanded] = useState(false);
  const [report, setReport] = useState<PanelReport>(IDLE_REPORT);

  // Pre-scan as soon as the sources change. Repeat runs are free: `scan` reuses
  // the analysis already running or finished for the same source set.
  useEffect(() => {
    if (!enabled || sources.length === 0) {
      setReport(IDLE_REPORT);
      return;
    }

    let isCurrent = true;
    setReport({ blueprint: null, isAnalyzing: true, failed: false });
    void scan(sources).then((blueprint) => {
      if (!isCurrent) return;
      setReport({ blueprint, isAnalyzing: false, failed: blueprint === null });
    });
    return () => {
      isCurrent = false;
    };
  }, [enabled, sources, scan]);

  const { blueprint, isAnalyzing, failed } = report;

  return (
    <div className="space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t('studio.aiScan.label')}
        title={t('studio.aiScan.hint')}
        onClick={() => setEnabled(!enabled)}
        className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[1.25rem] border px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
          enabled
            ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.12]'
            : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
        }`}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true">✨</span>
          <span>{t('studio.aiScan.label')}</span>
        </span>
        <span className="text-xs font-semibold tracking-[0.12em]">
          {enabled ? t('studio.aiScan.on') : t('studio.aiScan.off')}
        </span>
      </button>

      {enabled && sources.length > 0 && (
        <div role="status" aria-live="polite">
          {isAnalyzing && (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-400">
              <Spinner className="h-3.5 w-3.5 border-zinc-400" />
              <span>{t('studio.aiScan.analyzing')}</span>
            </div>
          )}

          {!isAnalyzing && blueprint && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium text-emerald-400">
                  <span aria-hidden="true">✨</span>
                  <span>{t('studio.aiScan.ready')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="rounded text-[11px] text-zinc-400 underline transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  {isExpanded ? t('studio.aiScan.hide') : t('studio.aiScan.view')}
                </button>
              </div>
              {isExpanded && (
                <div className="mt-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {blueprint}
                </div>
              )}
            </div>
          )}

          {!isAnalyzing && !blueprint && failed && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300/90">
              {t('studio.aiScan.unavailable')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AiScanPanel;
