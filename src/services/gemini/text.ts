
import { Part } from "@google/genai";
import { ImageFile } from '../../types';
import { getGeminiClient } from '../apiClient';

export const generateText = async (prompt: string, model: string = 'gemini-3.5-flash'): Promise<string> => {
  const ai = getGeminiClient();
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
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

export const generateImageDescription = async (image: ImageFile, model: string = 'gemini-3.5-flash'): Promise<string> => {
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
      model,
      contents: [{ role: 'user', parts: [imagePart, textPart] }],
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

export const generateClothingDescription = async (image: ImageFile, model: string = 'gemini-3.5-flash'): Promise<string> => {
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
      model,
      contents: [{ role: 'user', parts: [imagePart, textPart] }],
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

export const generatePoseDescription = async (image: ImageFile, model: string = 'gemini-3.5-flash'): Promise<string> => {
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
      model,
      contents: [{ role: 'user', parts: [imagePart, textPart] }],
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

export const generateStylePromptFromImage = async (image: ImageFile, model: string = 'gemini-3.5-flash'): Promise<string> => {
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
      model,
      contents: [{ role: 'user', parts: [imagePart, textPart] }],
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

export const analyzeScene = async (image: ImageFile, model: string = 'gemini-3.5-flash'): Promise<string> => {
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
    model,
    contents: [{ role: 'user', parts: [imagePart, textPart] }],
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

export const analyzeOutfitBlueprint = async (
  image: ImageFile,
  model: string = 'gemini-3.8-flash',
  userGuidance?: string,
): Promise<string> => {
  const ai = getGeminiClient();
  try {
    const imagePart: Part = {
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    };
    const userGuidanceBlock = userGuidance?.trim()
      ? `\n\n[USER DIRECTIVE & CLASSIFICATION OVERRIDE (HIGHEST PRIORITY)]
The user explicitly specifies the following context/guidance for this outfit:
"${userGuidance.trim()}"
You MUST strictly follow this directive. For instance, if the user notes that an item is trousers/pants (or not a skirt), classify it strictly as trousers/pants and deconstruct its legs accordingly.\n`
      : '';

    const prompt = `You are an expert haute couture and commercial fashion analyst.
Deconstruct the fashion outfit in this photo into an exhaustive, highly technical specification for an AI image generation pipeline.${userGuidanceBlock}

Structure your analysis strictly into the following 3 distinct bounded sections with these exact headers:

[1. CORE_GARMENTS]
- Layer & piece identification (Top, Bottom, One-Piece, Outerwear).
- Treat belts as supporting apparel when they are part of the outfit; belts are supporting apparel, not generic non-apparel accessories.
- Exact silhouette, fit, cuts, waistline, neckline/collar, sleeve style, closures.
- GARMENT BIFURCATION & BOTTOM CLASSIFICATION RULE (CRITICAL):
  * You MUST deterministically classify any lower-body garment as either bifurcated (Trousers/Pants/Shorts/Culottes/Balloon pants with 2 separate leg openings) or continuous (Skirt with a single continuous sweep/hem circumference).
  * Always inspect the ankle and leg hemline: if there are two distinct gathered cuffs, leg openings, or visible independent leg openings around the ankles/feet, it is TROUSERS/PANTS (even if voluminous, drop-crotch, balloon-shaped, or draped like a skirt).
  * STRICT ANTI-HEDGING RULE: NEVER use ambiguous hedging phrases such as "A (or B)", "skirt or trousers", "dress or skirt", "maybe", or "either/or". Commit decisively to ONE definitive garment category based on visual evidence.
- MICRO-EDGE & HEMLINE DETAILS: scalloped lace edges, fringes, cuffs, sheer mesh bands, contrast stitching.

[2. TEXTILE_PHYSICS]
- WEAVE & MATERIAL: fabric structure, fiber composition (chiffon, organza, plissé pleats, raw denim, ribbed knit, silk satin, tweed, lace).
- OPTICAL PROPERTIES & FINISH: sheer translucency vs opaque lining, matte vs satin luster, glazed sheen, hand feel.
- WEIGHT & DRAPE PHYSICS: fluidity, rigidity, structural hold, gravity folds, tension lines, flare.

[3. DETECTED_ACCESSORIES]
- Inventory of non-apparel items: bags, footwear, hosiery/tights, jewelry, hair accessories, hats.
(If none detected, state: None).

Keep the output factual, structured, and focused strictly on clothing construction and textile behavior to guide photorealistic reproduction.`;
    const textPart: Part = { text: prompt };
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [imagePart, textPart] }],
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
  } catch (error) {
    console.error('Error analyzing outfit blueprint with Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'error.unknown';
    throw new Error(
      errorMessage.startsWith('error.') ? errorMessage : `error.api.descriptionFailed:${errorMessage}`,
    );
  }
};
