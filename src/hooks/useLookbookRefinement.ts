import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageFile, RefinementHistoryItem } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { createImageChatSession, ImageChatSession } from '../services/imageEditingService';
import type { GeminiImageDriver, LookbookSet } from './useLookbookGeneration';

type TranslateFn = (key: string, options?: { [key: string]: string | number }) => string;

export interface UseLookbookRefinementConfig {
  driver: GeminiImageDriver;
  generatedLookbook: LookbookSet | null;
  setGeneratedLookbook: React.Dispatch<React.SetStateAction<LookbookSet | null>>;
  imageEditModel: string;
  buildImageServiceConfig: (onStatusUpdate: (message: string) => void) => { onStatusUpdate: (message: string) => void };
  setError: (message: string | null) => void;
  t: TranslateFn;
}

export interface UseLookbookRefinementReturn {
  chatSession: ImageChatSession | null;
  refinementHistory: RefinementHistoryItem[];
  isRefining: boolean;
  refinementVersions: Array<{ image: ImageFile; prompt: string; timestamp: number }>;
  setRefinementVersions: React.Dispatch<React.SetStateAction<Array<{ image: ImageFile; prompt: string; timestamp: number }>>>;
  selectedVersionIndex: number;
  setSelectedVersionIndex: React.Dispatch<React.SetStateAction<number>>;
  originalImageRef: React.RefObject<ImageFile | null>;
  onMainImageGenerated: (image: ImageFile) => void;
  handleRefineImage: (prompt: string) => Promise<void>;
  handleResetRefinement: () => void;
  handleSelectVersion: (index: number) => void;
}

/**
 * Refinement sub-hook for Lookbook: chat session lifecycle, refinement version
 * tracking, and version selection. Extracted to keep useLookbookGenerator under
 * the line limit. Exposes onMainImageGenerated so the generation engine can
 * reset refinement state when a new main image is produced.
 */
export const useLookbookRefinement = (
  config: UseLookbookRefinementConfig,
): UseLookbookRefinementReturn => {
  const { generatedLookbook, setGeneratedLookbook, imageEditModel,
    buildImageServiceConfig, setError, t } = config;

  const [chatSession, setChatSession] = useState<ImageChatSession | null>(null);
  const [refinementHistory, setRefinementHistory] = useState<RefinementHistoryItem[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [refinementVersions, setRefinementVersions] = useState<Array<{ image: ImageFile; prompt: string; timestamp: number }>>([]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(-1);
  const originalImageRef = useRef<ImageFile | null>(null);

  // Re-create chat session when a lookbook exists but the session is missing
  // (e.g. after resetRefinement nulls the session).
  useEffect(() => {
    if (generatedLookbook && !chatSession) {
      const session = createImageChatSession(imageEditModel, buildImageServiceConfig(() => {}));
      setChatSession(session);
    }
  }, [generatedLookbook, chatSession, imageEditModel, buildImageServiceConfig]);

  const onMainImageGenerated = useCallback((image: ImageFile) => {
    originalImageRef.current = image;
    setRefinementVersions([]);
    setSelectedVersionIndex(-1);
    const session = createImageChatSession(imageEditModel, buildImageServiceConfig(() => {}));
    setChatSession(session);
    setRefinementHistory([]);
  }, [imageEditModel, buildImageServiceConfig]);

  const handleSelectVersion = useCallback((index: number) => {
    if (index === -1 && originalImageRef.current) {
      setGeneratedLookbook((prev) => prev ? {
        ...prev,
        main: originalImageRef.current!,
        variations: [],
        closeups: [],
      } : null);
    } else if (index >= 0 && index < refinementVersions.length) {
      setGeneratedLookbook((prev) => prev ? {
        ...prev,
        main: refinementVersions[index].image,
        variations: [],
        closeups: [],
      } : null);
    }
    setSelectedVersionIndex(index);
  }, [refinementVersions, setGeneratedLookbook]);

  const handleRefineImage = useCallback(async (prompt: string) => {
    if (!chatSession || !generatedLookbook) {
      setError(t('lookbook.refineError'));
      return;
    }

    setIsRefining(true);
    setError(null);

    try {
      const refinedImage = await chatSession.sendRefinement(
        prompt,
        generatedLookbook.main,
      );

      setRefinementVersions((prev) => [...prev, {
        image: refinedImage,
        prompt,
        timestamp: Date.now(),
      }]);
      setSelectedVersionIndex((prev) => prev + 1);

      setGeneratedLookbook((prev) => prev ? {
        ...prev,
        main: refinedImage,
        variations: [],
        closeups: [],
      } : null);

      setRefinementHistory(chatSession.getHistory());
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsRefining(false);
    }
  }, [chatSession, generatedLookbook, t, setError, setGeneratedLookbook]);

  const handleResetRefinement = useCallback(() => {
    if (chatSession) {
      chatSession.reset();
      setChatSession(null);
      setRefinementHistory([]);
    }
  }, [chatSession]);

  return {
    chatSession,
    refinementHistory,
    isRefining,
    refinementVersions,
    setRefinementVersions,
    selectedVersionIndex,
    setSelectedVersionIndex,
    originalImageRef,
    onMainImageGenerated,
    handleRefineImage,
    handleResetRefinement,
    handleSelectVersion,
  };
};
