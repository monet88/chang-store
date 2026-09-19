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
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
      <span id={labelId} className="font-medium text-zinc-400">{t('studio.workflows.aspectRatioLabel')}:</span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap justify-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] p-1"
      >
        {RATIOS.map(ratio => {
          const isSelected = aspectRatio === ratio;

          return (
            <label
              key={ratio}
              className={`flex min-h-[28px] min-w-[32px] cursor-pointer items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-amber-500 ${isSelected ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-white/6'
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
