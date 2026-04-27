import { useCallback, useState } from 'react';
import { useApi } from '../contexts/ApiProviderContext';
import { useLanguage } from '../contexts/LanguageContext';
import { editImage } from '../services/imageEditingService';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, ImageFile, ImageResolution } from '../types';
import { getErrorMessage } from '../utils/imageUtils';

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
  const { imageEditModel } = useApi();

  const [images, setImages] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<ImageFile | null>(null);
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
        return `# INSTRUCTION: IMAGE EDITING

## USER REQUEST:
${userPrompt}

## OUTPUT:
Return the edited image as the final result.`;
      }

      const imageRoles = mentionedImages
        .map((image, index) => {
          const originalIndex = images.indexOf(image);
          const tag = `@img${originalIndex + 1}`;
          return `- Image ${index + 1} is ${tag}`;
        })
        .join('\n');

      return `# INSTRUCTION: MULTI-IMAGE EDITING

## IMAGE ROLES:
${imageRoles}

## USER REQUEST:
${userPrompt}

## CRITICAL RULES:
1. Analyze all provided images based on the user's request
2. Apply edits as described, using referenced images appropriately
3. Maintain image quality and natural appearance

## OUTPUT:
Return the final edited image.`;
    },
    [images],
  );

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (images.length === 0) {
      setError(t('aiEditor.error.noImages'));
      return;
    }

    if (!prompt.trim()) {
      setError(t('aiEditor.error.noPrompt'));
      return;
    }

    setIsLoading(true);
    setError(null);

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

      setResultImage(result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [
    images,
    prompt,
    aspectRatio,
    resolution,
    imageEditModel,
    extractMentionedImages,
    buildApiPrompt,
    t,
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
