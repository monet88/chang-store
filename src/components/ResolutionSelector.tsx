import React, { useEffect, useId } from 'react';
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
  const supportedResolutions = useModelImageResolutions(model);
  const fallbackResolution = supportedResolutions[0];
  const isFixedResolution = supportedResolutions.length === 1;
  const effectiveResolution = supportedResolutions.includes(resolution) ? resolution : fallbackResolution;
  const labelId = useId();
  const groupName = useId();

  useEffect(() => {
    if (!supportedResolutions.includes(resolution) && fallbackResolution) {
      setResolution(fallbackResolution);
    }
  }, [fallbackResolution, resolution, setResolution, supportedResolutions]);

  if (isFixedResolution) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span id={labelId} className="font-medium text-zinc-300">{t('virtualTryOn.quality')}:</span>
        <div
          aria-labelledby={labelId}
          className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5"
        >
          <span className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-zinc-950">
            {effectiveResolution}
          </span>
          <span className="pr-2 text-xs text-zinc-400">{t('virtualTryOn.modelLimit')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span id={labelId} className="font-medium text-zinc-300">{t('virtualTryOn.quality')}:</span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5"
      >
        {supportedResolutions.map(res => {
          const isSelected = effectiveResolution === res;

          return (
            <label
              key={res}
              className={`flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber-500 ${isSelected ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-white/6'
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
