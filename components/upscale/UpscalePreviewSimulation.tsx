/**
 * UpscalePreviewSimulation — Advisory preview of expected upscale improvements.
 *
 * Displays the simulated preview text with distinct amber/warning styling
 * to make it clear this is NOT a guaranteed result (PRV-02).
 * Renders each line with formatting and includes a prominent disclaimer.
 */

import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface UpscalePreviewSimulationProps {
  /** The preview simulation text (null = not generated) */
  preview: string | null;
}

const UpscalePreviewSimulation: React.FC<UpscalePreviewSimulationProps> = ({ preview }) => {
  const { t } = useLanguage();

  if (!preview) return null;

  const lines = preview.split('\n').filter((line) => line.trim().length > 0);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
      {/* Header badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-400 uppercase tracking-wider">
          ⚠️ {t('upscale.previewTitle')}
        </span>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-amber-400/70 mb-3 italic">
        {t('upscale.previewDisclaimer')}
      </p>

      {/* Preview lines */}
      <div className="space-y-2">
        {lines.map((line, index) => (
          <p
            key={index}
            className={`text-sm leading-relaxed ${
              line.startsWith('⚠️')
                ? 'text-amber-300'
                : line.startsWith('🔍') || line.startsWith('🧵') || line.startsWith('💡')
                  ? 'text-zinc-300'
                  : 'text-zinc-400'
            }`}
          >
            {line}
          </p>
        ))}
      </div>

      {/* Advisory footer */}
      <p className="mt-3 pt-3 border-t border-amber-500/10 text-xs text-amber-400/50">
        {t('upscale.previewAdvisory')}
      </p>
    </div>
  );
};

export default UpscalePreviewSimulation;
