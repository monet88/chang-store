/**
 * Wardrobe Mode Hook (orchestrator)
 *
 * Composes list management (useWardrobeModeList) and generation engine (useWardrobeModeEngine).
 * Builds driver seam for editImage. Preserves exact public return surface.
 */

import { useState, useMemo, useCallback } from 'react';
import type { ImageFile, ImageResolution, AspectRatio, ImageEditModel } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { editImage } from '../services/imageEditingService';
import { downloadImagesAsZip } from '../utils/zipDownload';
import { getErrorMessage } from '../utils/imageUtils';
import { Feature } from '../types';
import { useWardrobeModeList } from './useWardrobeModeList';
import { useWardrobeModeEngine, type WardrobeImageDriver } from './useWardrobeModeEngine';

interface UseWardrobeModeParams {
  imageEditModel: ImageEditModel;
  numImages: number;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  isParentGenerating: boolean;
}

export const useWardrobeMode = (params: UseWardrobeModeParams) => {
  const { t } = useLanguage();

  const list = useWardrobeModeList();

  const [results, setResults] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const driver = useMemo<WardrobeImageDriver>(() => ({ editImage }), []);

  const engine = useWardrobeModeEngine({
    driver,
    sets: list.sets,
    subject: list.subject,
    extraPrompt: list.extraPrompt,
    backgroundPrompt: list.backgroundPrompt,
    numImages: params.numImages,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
    imageEditModel: params.imageEditModel,
    isParentGenerating: params.isParentGenerating,
    isGenerating,
    t,
    setResults,
    setIsGenerating,
    setError,
    setLoadingMessage,
  });

  const download = useCallback(async () => {
    const allImages = results.filter((r: any) => r.status === 'completed').flatMap((r: any) => r.results);
    if (allImages.length === 0) return;
    try {
      await downloadImagesAsZip(allImages, `${Feature.TryOn}-wardrobe`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }, [results, t]);

  // Setting or clearing the subject clears any prior input error (matches the
  // pre-split orchestrator behavior; error state lives here, not in the list).
  const setSubject = useCallback((image: ImageFile | null) => {
    list.setSubject(image);
    setError(null);
  }, [list]);

  const clearSubject = useCallback(() => {
    list.clearSubject();
    setError(null);
  }, [list]);

  return {
    sets: list.sets,
    subject: list.subject,
    extraPrompt: list.extraPrompt,
    setExtraPrompt: list.setExtraPrompt,
    backgroundPrompt: list.backgroundPrompt,
    setBackgroundPrompt: list.setBackgroundPrompt,
    results,
    isGenerating,
    error,
    loadingMessage,
    addSet: list.addSet,
    removeSet: list.removeSet,
    addItem: list.addItem,
    removeItem: list.removeItem,
    updateItem: list.updateItem,
    setSubject,
    clearSubject,
    generate: engine.generate,
    download,
    maxSets: list.maxSets,
    maxItemsPerSet: list.maxItemsPerSet,
  };
};

export type WardrobeModeReturn = ReturnType<typeof useWardrobeMode>;
