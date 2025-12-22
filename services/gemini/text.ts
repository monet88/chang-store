
import { Part, Type } from "@google/genai";
import { ImageFile, AnalyzedItem } from '../../types';
import { getGeminiClient } from '../apiClient';

export const generateText = async (prompt: string, model: string = 'gemini-2.5-pro'): Promise<string> => {
  const ai = getGeminiClient();
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        thinkingConfig: {
            thinkingBudget: 32768,
        },
      },
    });

    if (response.promptFeedback?.blockReason) {
        console.error("Request blocked due to prompt feedback:", JSON.stringify(response.promptFeedback, null, 2));
        throw new Error('error.api.safetyBlock');
    }
    
    if (!response.candidates || response.candidates.length === 0) {
        console.error("API response contained no candidates, likely due to a safety block. Full response:", JSON.stringify(response, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    const candidate = response.candidates[0];
    const finishReason = candidate.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
        console.error("Request blocked due to content safety reason:", finishReason, JSON.stringify(candidate.safetyRatings, null, 2));
        throw new Error('error.api.safetyBlock');
    }
    
    const text = response.text;
    if (text) {
      return text.trim();
    }
    
    console.error("API response had no text content. Full response:", JSON.stringify(response, null, 2));
    throw new Error('error.api.noText');

  } catch (error) {
    console.error("Error generating text with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.geminiFailed:${errorMessage}`);
  }
};

export const generateImageDescription = async (image: ImageFile): Promise<string> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = {
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    };
    const prompt = "Describe this image as a photorealistic background for a fashion photoshoot. Focus on lighting, environment, mood, and key elements. Be concise and descriptive.";
    const textPart: Part = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });

    if (response.promptFeedback?.blockReason) {
        console.error("Request blocked due to prompt feedback:", JSON.stringify(response.promptFeedback, null, 2));
        throw new Error('error.api.safetyBlock');
    }
    
    if (!response.candidates || response.candidates.length === 0) {
        console.error("API response contained no candidates, likely due to a safety block. Full response:", JSON.stringify(response, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    const candidate = response.candidates[0];
    const finishReason = candidate.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
        console.error("Request blocked due to content safety reason:", finishReason, JSON.stringify(candidate.safetyRatings, null, 2));
        throw new Error('error.api.safetyBlock');
    }
      
    const description = response.text;
    if (description) {
      return description.trim();
    }
    
    console.error("API response had no text description. Full response:", JSON.stringify(response, null, 2));
    throw new Error('error.api.noTextDescription');

  } catch (error) {
    console.error("Error generating image description with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.descriptionFailed:${errorMessage}`);
  }
};

export const generateClothingDescription = async (image: ImageFile): Promise<string> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = {
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    };
    const prompt = "Analyze the provided image of a clothing or accessory item. Provide a detailed and concise description covering its category (e.g., dress, shirt, necklace), material (e.g., silk, cotton, denim, gold), pattern (e.g., floral, striped, solid), color, and any notable design features (e.g., v-neck, puff sleeves, intricate details). Focus only on describing the single main item in a way that helps an AI model recreate it accurately.";
    const textPart: Part = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });

    if (response.promptFeedback?.blockReason) {
        console.error("Request blocked due to prompt feedback:", JSON.stringify(response.promptFeedback, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    if (!response.candidates || response.candidates.length === 0) {
        console.error("API response contained no candidates, likely due to a safety block. Full response:", JSON.stringify(response, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    const candidate = response.candidates[0];
    const finishReason = candidate.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
        console.error("Request blocked due to content safety reason:", finishReason, JSON.stringify(candidate.safetyRatings, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    const description = response.text;
    if (description) {
      return description.trim();
    }
    
    console.error("API response had no text description. Full response:", JSON.stringify(response, null, 2));
    throw new Error('error.api.noText');
  } catch (error) {
    console.error("Error generating clothing description with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.clothingDescriptionFailed:${errorMessage}`);
  }
};

export const generatePoseDescription = async (image: ImageFile): Promise<string> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = {
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    };
    const prompt = "Analyze the pose of the person in this image. Describe it in detail, focusing on the position of the head, torso, arms, and legs. Be concise and descriptive, suitable for an AI to recreate the pose.";
    const textPart: Part = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });

    if (response.promptFeedback?.blockReason) {
        console.error("Request blocked due to prompt feedback:", JSON.stringify(response.promptFeedback, null, 2));
        throw new Error('error.api.safetyBlock');
    }
    
    if (!response.candidates || response.candidates.length === 0) {
        console.error("API response contained no candidates, likely due to a safety block. Full response:", JSON.stringify(response, null, 2));
        throw new Error('error.api.safetyBlock');
    }

    const candidate = response.candidates[0];
    const finishReason = candidate.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
        console.error("Request blocked due to content safety reason:", finishReason, JSON.stringify(candidate.safetyRatings, null, 2));
        throw new Error('error.api.safetyBlock');
    }
      
    const description = response.text;
    if (description) {
      return description.trim();
    }
    
    console.error("API response had no text description for pose. Full response:", JSON.stringify(response, null, 2));
    throw new Error('error.api.noTextDescription');

  } catch (error) {
    console.error("Error generating pose description with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.poseDescriptionFailed:${errorMessage}`);
  }
};

export const analyzeOutfit = async (image: ImageFile): Promise<AnalyzedItem[]> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = {
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    };
    const textPart: Part = {
      text: `Analyze the provided image of a person's outfit. Identify each distinct clothing item and accessory (e.g., shirt, pants, shoes, watch, handbag). For each item, provide a concise description and suggest 2-3 high-end or popular brand names that might offer a similar style. Structure the output as a JSON array.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              item: {
                type: Type.STRING,
                description: 'The name of the clothing item or accessory (e.g., "White T-Shirt", "Leather Handbag").',
              },
              description: {
                type: Type.STRING,
                description: 'A concise description of the item, including material, style, and color.',
              },
              possibleBrands: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'A list of 2-3 popular or high-end brands known for similar styles.',
              },
            },
            required: ['item', 'description', 'possibleBrands'],
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error('error.api.noContent');
    }

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

  } catch (error) {
    console.error("Error analyzing outfit with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.analysisFailed:${errorMessage}`);
  }
};

export const generateStylePromptFromImage = async (image: ImageFile, model: string = 'gemini-2.5-pro'): Promise<string> => {
    const ai = getGeminiClient();
    const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };
    const prompt = `# ROLE
You are an expert Art Director AI. Your task is to analyze a reference image and generate a detailed, descriptive text prompt that another AI can use to recreate the image's style, mood, and composition with a different subject.

# ANALYSIS & PROMPT GENERATION
1.  **Scene & Composition**: Describe the environment (e.g., studio, outdoor, abstract), subject framing (e.g., close-up, full-body), and overall composition (e.g., rule of thirds, centered, symmetrical).
2.  **Lighting Style**: Analyze the lighting. Is it soft and diffused, hard and dramatic, natural daylight, or stylized studio lighting? Describe the key light direction, fill light, and any rim lighting or backlighting.
3.  **Color Palette & Mood**: Describe the overall color scheme (e.g., warm tones, monochromatic, vibrant, pastel) and the emotional mood it creates (e.g., serene, energetic, nostalgic, moody).
4.  **Subject Style**: Describe the subject's pose, expression, and general style (e.g., "A person standing confidently," "A close-up portrait with a gentle smile").
5.  **Artistic Medium & Texture**: Identify the medium. Is it a photorealistic image, a digital painting, an oil painting, watercolor, 3D render? Describe textures, film grain, brush strokes, or any other distinctive stylistic elements.

# OUTPUT FORMAT
Return a single, comprehensive paragraph that synthesizes all the above points into a coherent and evocative prompt. Do not include markdown or titles.`;

    const textPart: Part = { text: prompt };

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [imagePart, textPart] },
      config: {
        thinkingConfig: {
            thinkingBudget: 32768,
        },
      },
    });
  
      if (response.promptFeedback?.blockReason) {
          throw new Error('error.api.safetyBlock');
      }
      if (!response.candidates || response.candidates.length === 0) {
          throw new Error('error.api.noContent');
      }
  
    const description = response.text;
    if (description) {
      return description.trim();
    }
    throw new Error('error.api.noTextDescription');
};

export const analyzeScene = async (image: ImageFile, model: string = 'gemini-2.5-pro'): Promise<string> => {
  const ai = getGeminiClient();
  const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };
  const prompt = `# ROLE
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

  const textPart: Part = { text: prompt };

  const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [imagePart, textPart] },
    config: {
      thinkingConfig: {
          thinkingBudget: 32768,
      },
    },
  });

    if (response.promptFeedback?.blockReason) {
        throw new Error('error.api.safetyBlock');
    }
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error('error.api.noContent');
    }

  const description = response.text;
  if (description) {
    return description.trim();
  }
  throw new Error('error.api.noTextDescription');
};
