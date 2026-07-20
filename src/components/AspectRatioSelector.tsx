import React, { useId } from 'react';
import { IMAGE_ASPECT_RATIOS, ImageAspectRatio } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AspectRatioSelectorProps {
  aspectRatio: ImageAspectRatio;
  setAspectRatio: (ratio: ImageAspectRatio) => void;
}

/** All selectable ratios including Default */
const RATIOS: ImageAspectRatio[] = ['Default', ...IMAGE_ASPECT_RATIOS];

const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = React.memo(({ aspectRatio, setAspectRatio }) => {
  const { t } = useLanguage();
  const labelId = useId();
  const groupName = useId();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span id={labelId} className="font-medium text-zinc-300">{t('studio.workflows.aspectRatioLabel')}:</span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5"
      >
        {RATIOS.map(ratio => {
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
  );
});

AspectRatioSelector.displayName = 'AspectRatioSelector';

export default AspectRatioSelector;
