import React, { useId } from 'react';
import type { AspectRatio } from '../../types';
import { useImageEngine, type ImageEngineOptions } from '../../contexts/ImageEngineContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface GptImageOptionsPanelProps {
  /** Ratio chosen by the feature hook; the engine maps it to a pixel size. */
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  numImages?: number;
  setNumImages?: (count: number) => void;
}

/**
 * The GPT studio's generation controls: a ratio picked from what the active
 * gateway's model can actually produce, the pixel size that ratio resolves to,
 * and the quality — each hidden when the (gateway, model) capability says the
 * field is meaningless there (issue #152, Decision 4).
 */
const GptImageOptionsPanel: React.FC<GptImageOptionsPanelProps> = ({ aspectRatio, setAspectRatio, numImages, setNumImages }) => {
  const { options } = useImageEngine();
  const { t } = useLanguage();
  const labelId = useId();
  const groupName = useId();
  const qualityId = useId();

  if (!options) {
    return null;
  }

  const ratios: AspectRatio[] = ['Default', ...options.ratios];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span id={labelId} className="font-medium text-zinc-300">{t('studio.workflows.aspectRatioLabel')}:</span>
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5"
        >
          {ratios.map((ratio) => {
            const isSelected = aspectRatio === ratio;

            return (
              <label
                key={ratio}
                className={`flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber-500 ${isSelected ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-white/6'
                  }`}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={ratio}
                  checked={isSelected}
                  onChange={() => setAspectRatio(ratio)}
                  className="sr-only"
                />
                {ratio}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-zinc-300">
        <span>
          {t('studio.workflows.sizeLabel')}:{' '}
          <span className="font-semibold text-zinc-100">{options.sizeFor(aspectRatio)}</span>
        </span>

        {options.supportsQuality && (
          <label htmlFor={qualityId} className="flex items-center gap-2">
            <span className="font-medium text-zinc-300">{t('studio.workflows.qualityLabel')}</span>
            <select
              id={qualityId}
              value={options.quality}
              onChange={(event) => options.setQuality(event.target.value as ImageEngineOptions['quality'])}
              className="workspace-input px-2 py-1"
            >
              {options.qualityOptions.map((quality) => (
                <option key={quality} value={quality}>{quality}</option>
              ))}
            </select>
          </label>
        )}

        {options.sizeObservation && (
          <span className="text-xs leading-5 text-zinc-500">
            {t('studio.workflows.sizeObservation', {
              honored: options.sizeObservation.honored,
              total: options.sizeObservation.total,
            })}
          </span>
        )}
      </div>

      {numImages !== undefined && setNumImages !== undefined && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">{t('virtualTryOn.numberOfImages')}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-semibold text-zinc-100">
              {numImages}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={numImages}
            onChange={(e) => setNumImages(Number(e.target.value))}
            className="w-full cursor-pointer accent-[var(--workspace-accent)]"
          />
        </div>
      )}
    </div>
  );
};

export default GptImageOptionsPanel;
