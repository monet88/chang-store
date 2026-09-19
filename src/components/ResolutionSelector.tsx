import React, { useId } from 'react';
import { ImageResolution } from '../types';
import { useModelImageResolutions } from '../hooks/useModelImageResolutions';
import { useLanguage } from '../contexts/LanguageContext';

interface ResolutionSelectorProps {
  resolution: ImageResolution;
  setResolution: (resolution: ImageResolution) => void;
  /** Current model - determines available resolutions */
  model?: string;
}

/**
 * Resolution selector with model-aware options
 * - gemini-2.5-flash-image: only 1K (fixed output ~1024px)
 * - gemini-3.1-flash-lite-image: only 1K
 * - gemini-3-pro-image: 1K, 2K, 4K available in this UI
 * - gemini-3.1-flash-image: 1K, 2K, 4K available in this UI
 * - Other models: all options available
 */
const ResolutionSelector: React.FC<ResolutionSelectorProps> = React.memo(({ resolution, setResolution, model }) => {
  const { t } = useLanguage();
  const { supportedResolutions, effectiveResolution, isFixedResolution } = useModelImageResolutions(
    model,
    resolution,
    setResolution,
  );
  const labelId = useId();
  const groupName = useId();

  if (isFixedResolution) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
        <span id={labelId} className="font-medium text-zinc-400">{t('virtualTryOn.quality')}:</span>
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] p-1"
        >
          <label className="flex min-h-[28px] min-w-[32px] cursor-not-allowed items-center justify-center rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-zinc-950">
            <input
              type="radio"
              name={groupName}
              value={effectiveResolution}
              checked
              disabled
              readOnly
              className="sr-only"
            />
            {effectiveResolution}
          </label>
          <span className="pr-1.5 text-[10px] text-zinc-400">{t('virtualTryOn.modelLimit')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
      <span id={labelId} className="font-medium text-zinc-400">{t('virtualTryOn.quality')}:</span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap justify-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] p-1"
      >
        {supportedResolutions.map(res => {
          const isSelected = effectiveResolution === res;

          return (
            <label
              key={res}
              className={`flex min-h-[28px] min-w-[32px] cursor-pointer items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-amber-500 ${isSelected ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-white/6'
                }`}
            >
              <input
                type="radio"
                name={groupName}
                value={res}
                checked={isSelected}
                onChange={() => setResolution(res)}
                className="sr-only"
              />
              {res}
            </label>
          );
        })}
      </div>
    </div>
  );
});

ResolutionSelector.displayName = 'ResolutionSelector';

export default ResolutionSelector;
