import React, { useEffect } from 'react';
import { IMAGE_RESOLUTIONS, ImageResolution } from '../types';

interface ResolutionSelectorProps {
  resolution: ImageResolution;
  setResolution: (resolution: ImageResolution) => void;
  /** Current model - determines available resolutions */
  model?: string;
}

/**
 * Resolution selector with model-aware options
 * - gemini-2.5-flash-image: only 1K (fixed output ~1024px)
 * - gemini-3-pro-image-preview: 0.5K, 1K, 2K, 4K all available
 * - gemini-3.1-flash-image-preview: 0.5K, 1K, 2K, 4K all available
 * - Other models: all options available
 */
const ResolutionSelector: React.FC<ResolutionSelectorProps> = React.memo(({ resolution, setResolution, model }) => {
  // Check if model only supports 1K
  const is25FlashModel = model?.includes('gemini-2.5-flash');

  // Auto-reset to 1K when switching to 2.5-flash model
  useEffect(() => {
    if (is25FlashModel && resolution !== '1K') {
      setResolution('1K');
    }
  }, [is25FlashModel, resolution, setResolution]);

  // If 2.5-flash model, show locked 1K indicator
  if (is25FlashModel) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="font-medium text-zinc-300">Quality:</span>
        <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5">
          <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-zinc-950">
            1K
          </span>
          <span className="px-3 py-1.5 text-xs italic text-zinc-500">
            (2.5-flash: 1K only)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="font-medium text-zinc-300">Quality:</span>
      <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5">
          {IMAGE_RESOLUTIONS.map(res => (
              <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                      resolution === res ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-white/6'
                  }`}
              >
                  {res}
              </button>
          ))}
      </div>
    </div>
  );
});

ResolutionSelector.displayName = 'ResolutionSelector';

export default ResolutionSelector;
