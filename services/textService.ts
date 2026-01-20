import { ImageFile, AnalyzedItem, TextGenerateModel } from '../types';
import * as geminiTextService from './gemini/text';
import {
  generateTextLocal,
  generateTextFromImageLocal,
} from './localProviderService';
import { logApiCall } from './debugService';

export interface TextServiceConfig {
  localApiBaseUrl?: string | null;
  localApiKey?: string | null;
}

const LOCAL_PREFIX = 'local--';

const IMAGE_DESCRIPTION_PROMPT = 'Describe this image as a photorealistic background for a fashion photoshoot. Focus on lighting, environment, mood, and key elements. Be concise and descriptive.';
const CLOTHING_DESCRIPTION_PROMPT = 'Analyze the provided image of a clothing or accessory item. Provide a detailed and concise description covering its category (e.g., dress, shirt, necklace), material (e.g., silk, cotton, denim, gold), pattern (e.g., floral, striped, solid), color, and any notable design features (e.g., v-neck, puff sleeves, intricate details). Focus only on describing the single main item in a way that helps an AI model recreate it accurately.';
const POSE_DESCRIPTION_PROMPT = 'Analyze the pose of the person in this image. Describe it in detail, focusing on the position of the head, torso, arms, and legs. Be concise and descriptive, suitable for an AI to recreate the pose.';
const OUTFIT_ANALYSIS_PROMPT = `Analyze the provided image of a person's outfit. Identify each distinct clothing item and accessory (e.g., shirt, pants, shoes, watch, handbag). For each item, provide a concise description and suggest 2-3 high-end or popular brand names that might offer a similar style. Structure the output as a JSON array.`;
const STYLE_PROMPT_FROM_IMAGE = `# ROLE
You are an expert Art Director AI. Your task is to analyze a reference image and generate a detailed, descriptive text prompt that another AI can use to recreate the image's style, mood, and composition with a different subject.

# ANALYSIS & PROMPT GENERATION
1.  **Scene & Composition**: Describe the environment (e.g., studio, outdoor, abstract), subject framing (e.g., close-up, full-body), and overall composition (e.g., rule of thirds, centered, symmetrical).
2.  **Lighting Style**: Analyze the lighting. Is it soft and diffused, hard and dramatic, natural daylight, or stylized studio lighting? Describe the key light direction, fill light, and any rim lighting or backlighting.
3.  **Color Palette & Mood**: Describe the overall color scheme (e.g., warm tones, monochromatic, vibrant, pastel) and the emotional mood it creates (e.g., serene, energetic, nostalgic, moody).
4.  **Subject Style**: Describe the subject's pose, expression, and general style (e.g., "A person standing confidently," "A close-up portrait with a gentle smile").
5.  **Artistic Medium & Texture**: Identify the medium. Is it a photorealistic image, a digital painting, an oil painting, watercolor, 3D render? Describe textures, film grain, brush strokes, or any other distinctive stylistic elements.

# OUTPUT FORMAT
Return a single, comprehensive paragraph that synthesizes all the above points into a coherent and evocative prompt. Do not include markdown or titles.`;
const ANALYZE_SCENE_PROMPT = `# ROLE
You are a Visual Scene Analyzer AI.
Your job is to interpret the uploaded reference image and produce a descriptive paragraph that captures every visual detail needed for cinematic video generation.

# OBJECTIVE
Generate a comprehensive yet factual description of what is seen in the image — the setting, subject, outfit, lighting, and emotional tone — that another AI can later use to recreate the same world as a moving video.

# ANALYSIS STEPS
1. **Background & Environment**
   - Identify where the scene takes place (e.g., garden, temple, urban street, studio).
   - Describe textures, architecture, color palette, and light direction.
   - Note time-of-day mood (morning, dusk, overcast).
2. **Subject / Character**
   - Describe the person's gender, age range, posture, body type, and expression.
   - Detail hairstyle, accessories, and gaze direction.
   - Keep language factual, not stylistic.
3. **Outfit & Material**
   - Specify every garment and accessory clearly: color, fabric, pattern, texture, and how it reacts to light.
   - Mention footwear if visible.
4. **Lighting & Atmosphere**
   - Observe key light direction, color temperature, intensity, and shadow softness.
   - Include reflections, rim highlights, or haze if present.
5. **Emotional & Cinematic Tone**
   - Infer the mood (calm, confident, melancholic, professional…).
   - Describe how the subject's pose and lighting contribute to that feeling.

# OUTPUT FORMAT
Return one clean paragraph in natural English — concise but complete.
Do not include stylistic opinions or hypothetical scenes.`;

const isLocalModel = (model: string) => model.startsWith(LOCAL_PREFIX);
const stripLocalPrefix = (model: string) => model.slice(LOCAL_PREFIX.length);

const buildLocalConfig = (config?: TextServiceConfig) => ({
  baseUrl: config?.localApiBaseUrl ?? '',
  apiKey: config?.localApiKey ?? null,
});

const parseOutfitAnalysis = (jsonText: string): AnalyzedItem[] => {
  let cleanJson = jsonText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.substring(7);
  }
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.substring(0, cleanJson.length - 3);
  }

  const data = JSON.parse(cleanJson);
  if (!Array.isArray(data)) {
    throw new Error('error.api.invalidAnalysis');
  }
  if (data.some(item => !item.item || !item.description || !item.possibleBrands)) {
    throw new Error('error.api.invalidAnalysis');
  }
  return data as AnalyzedItem[];
};

export const generateText = async (
  prompt: string,
  model: TextGenerateModel,
  config?: TextServiceConfig
): Promise<string> => {
  const startTime = Date.now();
  const provider = isLocalModel(model) ? 'Local' : 'Gemini';

  try {
    const result = isLocalModel(model)
      ? await generateTextLocal(prompt, stripLocalPrefix(model), buildLocalConfig(config))
      : await geminiTextService.generateText(prompt, model);

    logApiCall({
      provider,
      model,
      feature: 'Text Generate',
      prompt,
      duration: Date.now() - startTime,
      status: 'success',
      responseSize: result.length,
    });

    return result;
  } catch (error) {
    logApiCall({
      provider,
      model,
      feature: 'Text Generate',
      prompt,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const generateImageDescription = async (
  image: ImageFile,
  model: string,
  config?: TextServiceConfig
): Promise<string> => {
  const startTime = Date.now();
  const provider = isLocalModel(model) ? 'Local' : 'Gemini';

  try {
    const result = isLocalModel(model)
      ? await generateTextFromImageLocal(image, IMAGE_DESCRIPTION_PROMPT, stripLocalPrefix(model), buildLocalConfig(config))
      : await geminiTextService.generateImageDescription(image);

    logApiCall({
      provider,
      model,
      feature: 'Image Description',
      prompt: IMAGE_DESCRIPTION_PROMPT,
      duration: Date.now() - startTime,
      status: 'success',
      responseSize: result.length,
    });

    return result;
  } catch (error) {
    logApiCall({
      provider,
      model,
      feature: 'Image Description',
      prompt: IMAGE_DESCRIPTION_PROMPT,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const generateClothingDescription = async (
  image: ImageFile,
  model: string,
  config?: TextServiceConfig
): Promise<string> => {
  const startTime = Date.now();
  const provider = isLocalModel(model) ? 'Local' : 'Gemini';

  try {
    const result = isLocalModel(model)
      ? await generateTextFromImageLocal(image, CLOTHING_DESCRIPTION_PROMPT, stripLocalPrefix(model), buildLocalConfig(config))
      : await geminiTextService.generateClothingDescription(image);

    logApiCall({
      provider,
      model,
      feature: 'Clothing Description',
      prompt: CLOTHING_DESCRIPTION_PROMPT,
      duration: Date.now() - startTime,
      status: 'success',
      responseSize: result.length,
    });

    return result;
  } catch (error) {
    logApiCall({
      provider,
      model,
      feature: 'Clothing Description',
      prompt: CLOTHING_DESCRIPTION_PROMPT,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const generatePoseDescription = async (
  image: ImageFile,
  model: string,
  config?: TextServiceConfig
): Promise<string> => {
  const startTime = Date.now();
  const provider = isLocalModel(model) ? 'Local' : 'Gemini';

  try {
    const result = isLocalModel(model)
      ? await generateTextFromImageLocal(image, POSE_DESCRIPTION_PROMPT, stripLocalPrefix(model), buildLocalConfig(config))
      : await geminiTextService.generatePoseDescription(image);

    logApiCall({
      provider,
      model,
      feature: 'Pose Description',
      prompt: POSE_DESCRIPTION_PROMPT,
      duration: Date.now() - startTime,
      status: 'success',
      responseSize: result.length,
    });

    return result;
  } catch (error) {
    logApiCall({
      provider,
      model,
      feature: 'Pose Description',
      prompt: POSE_DESCRIPTION_PROMPT,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const analyzeOutfit = async (
  image: ImageFile,
  model: string,
  config?: TextServiceConfig
): Promise<AnalyzedItem[]> => {
  const startTime = Date.now();
  const provider = isLocalModel(model) ? 'Local' : 'Gemini';

  try {
    const result = isLocalModel(model)
      ? parseOutfitAnalysis(
          await generateTextFromImageLocal(
            image,
            OUTFIT_ANALYSIS_PROMPT,
            stripLocalPrefix(model),
            buildLocalConfig(config)
          )
        )
      : await geminiTextService.analyzeOutfit(image);

    logApiCall({
      provider,
      model,
      feature: 'Outfit Analysis',
      prompt: OUTFIT_ANALYSIS_PROMPT,
      duration: Date.now() - startTime,
      status: 'success',
      responseSize: JSON.stringify(result).length,
    });

    return result;
  } catch (error) {
    logApiCall({
      provider,
      model,
      feature: 'Outfit Analysis',
      prompt: OUTFIT_ANALYSIS_PROMPT,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const generateStylePromptFromImage = async (
  image: ImageFile,
  model: string,
  config?: TextServiceConfig
): Promise<string> => {
  const startTime = Date.now();
  const provider = isLocalModel(model) ? 'Local' : 'Gemini';

  try {
    const result = isLocalModel(model)
      ? await generateTextFromImageLocal(
          image,
          STYLE_PROMPT_FROM_IMAGE,
          stripLocalPrefix(model),
          buildLocalConfig(config)
        )
      : await geminiTextService.generateStylePromptFromImage(image, model);

    logApiCall({
      provider,
      model,
      feature: 'Style Prompt',
      prompt: STYLE_PROMPT_FROM_IMAGE,
      duration: Date.now() - startTime,
      status: 'success',
      responseSize: result.length,
    });

    return result;
  } catch (error) {
    logApiCall({
      provider,
      model,
      feature: 'Style Prompt',
      prompt: STYLE_PROMPT_FROM_IMAGE,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const analyzeScene = async (
  image: ImageFile,
  model: string,
  config?: TextServiceConfig
): Promise<string> => {
  const startTime = Date.now();
  const provider = isLocalModel(model) ? 'Local' : 'Gemini';

  try {
    const result = isLocalModel(model)
      ? await generateTextFromImageLocal(
          image,
          ANALYZE_SCENE_PROMPT,
          stripLocalPrefix(model),
          buildLocalConfig(config)
        )
      : await geminiTextService.analyzeScene(image, model);

    logApiCall({
      provider,
      model,
      feature: 'Scene Analysis',
      prompt: ANALYZE_SCENE_PROMPT,
      duration: Date.now() - startTime,
      status: 'success',
      responseSize: result.length,
    });

    return result;
  } catch (error) {
    logApiCall({
      provider,
      model,
      feature: 'Scene Analysis',
      prompt: ANALYZE_SCENE_PROMPT,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};
