import { getModelCapabilities } from '../config/modelRegistry';
import { IMAGE_RESOLUTIONS, ImageResolution } from '../types';

export const useModelImageResolutions = (model?: string): readonly ImageResolution[] =>
  getModelCapabilities(model ?? '').supportedImageSizes ?? IMAGE_RESOLUTIONS;