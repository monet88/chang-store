import { useCallback, useRef, useState } from 'react';
import { useImageEngine } from '../contexts/ImageEngineContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, Feature, ImageEngineId, ImageFile, ImageResolution } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { detectImageAspectRatio } from '../utils/imageAspectRatio';
import {
  buildSingleImageEditPrompt,
  buildMultiImageEditPrompt,
  buildQwenSingleImageEditPrompt,
  buildQwenMultiImageEditPrompt,
} from '../utils/ai-editor-prompt-builder';

const MENTION_REGEX = /@img(\d+)/g;

interface MentionedImageSelection {
  images: ImageFile[];
  invalidRefs: string[];
  hasMentions: boolean;
}

export interface UseAIEditorReturn {
  images: ImageFile[];
  setImages: (images: ImageFile[]) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  error: string | null;
  refLimitNotice?: string | null;
  resultImage: ImageFile | null;
  aspectRatio: AspectRatio;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  resolution: ImageResolution;
  setResolution: (resolution: ImageResolution) => void;
  imageEditModel: string;
  handleGenerate: () => Promise<void>;
  handleUpscale: (image: ImageFile) => Promise<void>;
  isUpscaling: boolean;
  clearError: () => void;
  engineId?: ImageEngineId;
}

export const useAIEditor = (): UseAIEditorReturn => {
  const { t } = useLanguage();
  const { editImage, upscaleImage, model: imageEditModel, id: engineId } = useImageEngine();
  const { addImage } = useImageGallery();

  const [images, setImages] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<ImageFile | null>(null);
  const generationInFlightRef = useRef(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  const updateImages = useCallback((newImages: ImageFile[] | ((prev: ImageFile[]) => ImageFile[])) => {
    setImages((prev) => {
      const next = typeof newImages === 'function' ? newImages(prev) : newImages;
      if (next.length > 0 && next[0]) {
        void detectImageAspectRatio(next[0]).then((detected) => {
          setAspectRatio(detected);
        });
      }
      return next;
    });
  }, []);
  const extractMentionedImages = useCallback(
    (promptText: string): MentionedImageSelection => {
      const matches = [...promptText.matchAll(MENTION_REGEX)];
      const mentionedNumbers = [...new Set(matches.map((match) => Number.parseInt(match[1], 10)))]
        .sort((left, right) => left - right);
      const validNumbers = mentionedNumbers.filter((number) => number >= 1 && number <= images.length);
      const invalidRefs = mentionedNumbers
        .filter((number) => number < 1 || number > images.length)
        .map((number) => `@img${number}`);

      return {
        images: validNumbers.map((number) => images[number - 1]),
        invalidRefs,
        hasMentions: matches.length > 0,
      };
    },
    [images],
  );

  const buildApiPrompt = useCallback(
    (userPrompt: string, mentionedImages: ImageFile[]): string => {
      if (engineId === 'localQwen') {
        if (mentionedImages.length === 0) {
          return buildQwenSingleImageEditPrompt(userPrompt);
        }

        const imageRoles = mentionedImages
          .map((image, index) => {
            const originalIndex = images.indexOf(image);
            const tag = `@img${originalIndex + 1}`;
            return `- Image ${index + 1} is ${tag}`;
          })
          .join('\n');

        return buildQwenMultiImageEditPrompt(userPrompt, imageRoles);
      }

      if (mentionedImages.length === 0) {
        return buildSingleImageEditPrompt(userPrompt);
      }

      const imageRoles = mentionedImages
        .map((image, index) => {
          const originalIndex = images.indexOf(image);
          const tag = `@img${originalIndex + 1}`;
          return `- Image ${index + 1} is ${tag}`;
        })
        .join('\n');

      return buildMultiImageEditPrompt(userPrompt, imageRoles);
    },
    [images, engineId],
  );

  /** Drop @imgN tokens whose image was not sent (local Qwen caps mentions at 4). */
  const stripDroppedMentions = useCallback(
    (promptText: string, keptImages: ImageFile[]): string => {
      const keptNumbers = new Set(keptImages.map((image) => images.indexOf(image) + 1));
      return promptText.replace(MENTION_REGEX, (match, digits: string) =>
        keptNumbers.has(Number.parseInt(digits, 10)) ? match : '',
      );
    },
    [images],
  );

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (generationInFlightRef.current) return;

    setError(null);
    setResultImage(null);

    if (images.length === 0) {
      setError(t('aiEditor.error.noImages'));
      return;
    }

    if (!prompt.trim()) {
      setError(t('aiEditor.error.noPrompt'));
      return;
    }

    const mentionedSelection = extractMentionedImages(prompt);
    if (mentionedSelection.invalidRefs.length > 0) {
      setError(t('aiEditor.error.invalidImageReferences', { refs: mentionedSelection.invalidRefs.join(', ') }));
      return;
    }

    generationInFlightRef.current = true;
    setIsLoading(true);
    try {
      const isLocalQwen = engineId === 'localQwen';
      const rawMentionedImages = mentionedSelection.images;
      const mentionedImages = isLocalQwen ? rawMentionedImages.slice(0, 4) : rawMentionedImages;

      const imagesToSend = mentionedSelection.hasMentions
        ? mentionedImages
        : (isLocalQwen ? images.slice(0, 4) : images);

      const userPrompt = mentionedSelection.hasMentions && mentionedImages.length < rawMentionedImages.length
        ? stripDroppedMentions(prompt, mentionedImages)
        : prompt;
      const apiPrompt = buildApiPrompt(userPrompt, mentionedImages);
      const [result] = await editImage(
        {
          images: imagesToSend,
          prompt: apiPrompt,
          numberOfImages: 1,
          aspectRatio,
          resolution,
        },
        imageEditModel,
        {
          onStatusUpdate: () => {},
        },
      );

      if (!result) {
        throw new Error('error.api.noImageGenerated');
      }

      setResultImage(result);
      addImage(result, Feature.AIEditor, engineId);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      generationInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [
    images,
    prompt,
    aspectRatio,
    resolution,
    editImage,
    imageEditModel,
    extractMentionedImages,
    stripDroppedMentions,
    buildApiPrompt,
    t,
    addImage,
    engineId,
  ]);

  const handleUpscale = useCallback(async (imageToUpscale: ImageFile): Promise<void> => {
    setIsUpscaling(true);
    setError(null);
    try {
      const result = await upscaleImage(imageToUpscale, imageEditModel, {
        onStatusUpdate: () => {},
      });
      setResultImage(result);
      addImage(result, Feature.AIEditor, engineId);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsUpscaling(false);
    }
  }, [addImage, engineId, imageEditModel, t, upscaleImage]);

  return {
    images,
    setImages: updateImages,
    prompt,
    setPrompt,
    isLoading,
    error,
    resultImage,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,
    imageEditModel,
    handleGenerate,
    handleUpscale,
    isUpscaling,
    clearError: () => setError(null),
    refLimitNotice: engineId === 'localQwen' && images.length > 4 && !extractMentionedImages(prompt).hasMentions
      ? t('aiEditor.localQwenRefLimitNotice')
      : null,
    engineId,
  };
};
