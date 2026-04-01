/**
 * ImageOptionsPanel - Unified image generation options component
 *
 * Combines AspectRatioSelector and ResolutionSelector into a single panel.
 * When adding new image options, only modify this file - all 9 features update automatically.
 */

import React from 'react';
import { AspectRatio, ImageResolution } from '../types';
import AspectRatioSelector from './AspectRatioSelector';
import ResolutionSelector from './ResolutionSelector';

interface ImageOptionsPanelProps {
  /** Current aspect ratio value */
  aspectRatio: AspectRatio;
  /** Callback to update aspect ratio */
  setAspectRatio: (ratio: AspectRatio) => void;
  /** Current resolution value */
  resolution: ImageResolution;
  /** Callback to update resolution */
  setResolution: (res: ImageResolution) => void;
  /** Model name - determines available resolution options (e.g., gemini-2.5-flash only supports 1K) */
  model: string;
}

/**
 * Unified panel for image generation options.
 * Currently includes: AspectRatio, Resolution (model-aware)
 *
 * Usage:
 * ```tsx
 * <ImageOptionsPanel
 *   aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
 *   resolution={resolution} setResolution={setResolution}
 *   model={imageEditModel}
 * />
 * ```
 */
const ImageOptionsPanel: React.FC<ImageOptionsPanelProps> = React.memo(({
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  model,
}) => {
  return (
    <div className="space-y-3">
      <AspectRatioSelector
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
      />
      <ResolutionSelector
        resolution={resolution}
        setResolution={setResolution}
        model={model}
      />
    </div>
  );
});

ImageOptionsPanel.displayName = 'ImageOptionsPanel';

export default ImageOptionsPanel;
