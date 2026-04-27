import { useState } from 'react';
import { AspectRatio, DEFAULT_IMAGE_RESOLUTION, ImageFile, ImageResolution } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { editImage } from '../services/imageEditingService';
import { getErrorMessage } from '../utils/imageUtils';

export type BacklightDirection = 'Left' | 'Center' | 'Right';
export type LightType = 'Natural' | '1 Light' | '2 Lights' | '3 Lights';
export type Quality = 'Standard' | '2K' | '4K';
export type LightColor = 'natural' | 'red' | 'green' | 'blue' | 'purple';

const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
  onStatusUpdate,
});

const getLightColorDescription = (color: LightColor): string => {
  let colorDesc = '';
  switch (color) {
    case 'natural':
      colorDesc = 'an extremely soft, warm, golden glow of a late afternoon sunset.';
      break;
    case 'red':
      colorDesc = 'a vibrant, saturated red glow, as if from a professional LED panel with a red gel.';
      break;
    case 'green':
      colorDesc = 'a vibrant, saturated green glow, as if from a professional LED panel with a green gel.';
      break;
    case 'blue':
      colorDesc = 'a cool, saturated blue glow, as if from a professional LED panel with a blue gel.';
      break;
    case 'purple':
      colorDesc = 'a rich, saturated purple glow, as if from a professional LED panel with a purple gel.';
      break;
  }
  return `${colorDesc}\n**CRITICAL LIGHTING STANDARD (Applies to this light):**\nThis light source MUST be powerful enough to create a clean, distinct, and photographically accurate **rim light** on the subject. The rim light's purpose is to trace the subject's outline, separating them from the background. This effect is the primary, mandatory objective. The light must be simulated as a large, professionally diffused source (like a softbox), resulting in a soft, flattering quality of light with smooth falloff.`;
};

const generateRelightPrompt = (
  direction: BacklightDirection,
  type: LightType,
  quality: Quality,
  customPrompt: string,
  light1Color: LightColor,
  light2Color: LightColor,
  light3Color: LightColor,
): string => {
  let prompt = `
# INSTRUCTION: PROFESSIONAL IMAGE RELIGHTING

## 1. CORE TASK
Your primary task is to relight the provided source image according to the specified lighting setup. You must preserve the subject, clothing, pose, and background with 100% accuracy. Only the lighting and shadows should change.

## 2. IMAGE QUALITY
- **Output Quality**: The final image must be rendered in ${quality} quality, with photorealistic textures, high detail, and no digital artifacts.

## 3. LIGHTING SETUP
`;

  if (type === 'Natural') {
    prompt += `
- **Light Type**: Natural Lighting.
- **Description**: Simulate soft, diffused natural light (like on an overcast day or from a large window) coming from the **${direction}**. The light should wrap gently around the subject, creating soft, natural-looking shadows. The mood should be clean and airy.
`;
  } else {
    const lightCount = type === '1 Light' ? 1 : type === '2 Lights' ? 2 : 3;
    prompt += `- **Light Type**: Studio Lighting (${lightCount} Light Setup).\n`;

    const lightPositions = {
      Left: ['the left', 'the right', 'above'],
      Center: ['directly in front', 'the left', 'the right'],
      Right: ['the right', 'the left', 'above'],
    } as const;
    const positions = lightPositions[direction];

    prompt += `
- **Light 1 (Key Light)**:
  - **Position**: Placed from **${positions[0]}** of the subject.
  - **Color & Quality**: This light should cast ${getLightColorDescription(light1Color)}
`;

    if (lightCount > 1) {
      prompt += `
- **Light 2 (Fill/Rim Light)**:
  - **Position**: Placed from **${positions[1]}** of the subject.
  - **Color & Quality**: This light should cast ${getLightColorDescription(light2Color)}
`;
    }

    if (lightCount > 2) {
      prompt += `
- **Light 3 (Accent/Hair Light)**:
  - **Position**: Placed from **${positions[2]}**, slightly behind the subject.
  - **Color & Quality**: This light should cast ${getLightColorDescription(light3Color)}
`;
    }
  }

  if (customPrompt.trim()) {
    prompt += `
## 4. ADDITIONAL INSTRUCTIONS
- Apply the following user-defined instruction: "${customPrompt.trim()}". This instruction should modify or enhance the lighting setup described above.
`;
  }

  prompt += `
## 5. STRICT NEGATIVE CONSTRAINTS
- DO NOT change the subject's face, body, pose, or clothing.
- DO NOT change the background or any environmental elements.
- DO NOT add or remove any objects.
- The only change should be the lighting and the resulting shadows and highlights.
`;
  return prompt.trim();
};

export const useRelight = () => {
  const { t } = useLanguage();
  const { imageEditModel } = useApi();

  const [image, setImage] = useState<ImageFile | null>(null);
  const [backlightDirection, setBacklightDirection] = useState<BacklightDirection>('Left');
  const [lightType, setLightType] = useState<LightType>('Natural');
  const [quality, setQuality] = useState<Quality>('2K');
  const [customPrompt, setCustomPrompt] = useState('');
  const [light1Color, setLight1Color] = useState<LightColor>('natural');
  const [light2Color, setLight2Color] = useState<LightColor>('natural');
  const [light3Color, setLight3Color] = useState<LightColor>('natural');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);

  const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRelight = async () => {
    if (!image) {
      setError(t('relight.inputError'));
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('relight.generatingStatus'));
    setError(null);

    const prompt = generateRelightPrompt(backlightDirection, lightType, quality, customPrompt, light1Color, light2Color, light3Color);

    try {
      const [result] = await editImage(
        { images: [image], prompt, numberOfImages: 1, aspectRatio, resolution },
        imageEditModel,
        buildImageServiceConfig(setLoadingMessage),
      );
      setGeneratedImage(result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  };

  const lightCount = lightType === '1 Light' ? 1 : lightType === '2 Lights' ? 2 : lightType === '3 Lights' ? 3 : 0;

  const lightTypeTranslations = {
    Natural: t('relight.natural'),
    '1 Light': t('relight.oneLight'),
    '2 Lights': t('relight.twoLights'),
    '3 Lights': t('relight.threeLights'),
  };

  return {
    t,
    imageEditModel,

    image,
    setImage,
    backlightDirection,
    setBacklightDirection,
    lightType,
    setLightType,
    quality,
    setQuality,
    customPrompt,
    setCustomPrompt,
    light1Color,
    setLight1Color,
    light2Color,
    setLight2Color,
    light3Color,
    setLight3Color,
    aspectRatio,
    setAspectRatio,
    resolution,
    setResolution,

    generatedImage,
    isLoading,
    loadingMessage,
    error,

    lightCount,
    lightTypeTranslations,

    handleRelight,
    clearError: () => setError(null),
  };
};
