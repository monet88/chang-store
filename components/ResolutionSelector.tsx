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
const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({ resolution, setResolution, model }) => {
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
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="text-slate-300 font-medium">Quality:</span>
        <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-lg">
          <span className="px-3 py-1.5 text-sm font-semibold rounded-md bg-amber-600 text-white">
            1K
          </span>
          <span className="px-3 py-1.5 text-xs text-slate-500 italic">
            (2.5-flash: 1K only)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <span className="text-slate-300 font-medium">Quality:</span>
      <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-lg flex-wrap justify-center">
          {IMAGE_RESOLUTIONS.map(res => (
              <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                      resolution === res ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'
                  }`}
              >
                  {res}
              </button>
          ))}
      </div>
    </div>
  );
};

export default ResolutionSelector;
