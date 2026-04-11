import React from 'react';
import { IMAGE_ASPECT_RATIOS, ImageAspectRatio } from '../types';

interface AspectRatioSelectorProps {
  aspectRatio: ImageAspectRatio;
  setAspectRatio: (ratio: ImageAspectRatio) => void;
}

/** All selectable ratios including Default */
const RATIOS: ImageAspectRatio[] = ['Default', ...IMAGE_ASPECT_RATIOS];

const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = React.memo(({ aspectRatio, setAspectRatio }) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="font-medium text-zinc-300">Aspect Ratio:</span>
      <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5">
          {RATIOS.map(ratio => (
              <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                      aspectRatio === ratio ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-white/6'
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
