import React, { useId } from 'react';
import { IMAGE_ASPECT_RATIOS, ImageAspectRatio } from '../types';

interface AspectRatioSelectorProps {
  aspectRatio: ImageAspectRatio;
  setAspectRatio: (ratio: ImageAspectRatio) => void;
}

/** All selectable ratios including Default */
const RATIOS: ImageAspectRatio[] = ['Default', ...IMAGE_ASPECT_RATIOS];

const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = React.memo(({ aspectRatio, setAspectRatio }) => {
  const labelId = useId();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span id={labelId} className="font-medium text-zinc-300">Aspect Ratio:</span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5">
        {RATIOS.map(ratio => (
          <button
            key={ratio}
            type="button"
            aria-pressed={aspectRatio === ratio}
            onClick={() => setAspectRatio(ratio)}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${aspectRatio === ratio ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-white/6'
              }`}
          >
            {ratio}
          </button>
        ))}
      </div>
    </div>
  );
});

AspectRatioSelector.displayName = 'AspectRatioSelector';

export default AspectRatioSelector;
