import { useCallback, useRef, useState } from 'react';
import { useImageEngine } from '../contexts/ImageEngineContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, Feature, ImageFile, ImageResolution } from '../types';
import { getErrorMessage } from '../utils/imageUtils';
import { buildSingleImageEditPrompt, buildMultiImageEditPrompt } from '../utils/ai-editor-prompt-builder';

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
  resultImage: ImageFile | null;
  aspectRatio: AspectRatio;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  resolution: ImageResolution;
  setResolution: (resolution: ImageResolution) => void;
  imageEditModel: string;
  handleGenerate: () => Promise<void>;
  clearError: () => void;
}

export const useAIEditor = (): UseAIEditorReturn => {
  const { t } = useLanguage();
  const { editImage, model: imageEditModel, id: engineId } = useImageEngine();
  const { addImage } = useImageGallery();

  const [images, setImages] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<ImageFile | null>(null);
  const generationInFlightRef = useRef(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

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
    [images],
  );

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (generationInFlightRef.current) return;

    if (images.length === 0) {
      setError(t('aiEditor.error.noImages'));
      return;
    }

    if (!prompt.trim()) {
      setError(t('aiEditor.error.noPrompt'));
      return;
    }

    generationInFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    setResultImage(null);

    try {
      const mentionedSelection = extractMentionedImages(prompt);
      if (mentionedSelection.invalidRefs.length > 0) {
        setError(t('aiEditor.error.invalidImageReferences', { refs: mentionedSelection.invalidRefs.join(', ') }));
        return;
      }

      const imagesToSend = mentionedSelection.hasMentions ? mentionedSelection.images : images;
      const apiPrompt = buildApiPrompt(prompt, mentionedSelection.images);

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
    buildApiPrompt,
    t,
    addImage,
    engineId,
  ]);

  return {
    images,
    setImages,
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
    clearError: () => setError(null),
  };
};
