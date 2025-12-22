
import { Part, Type, GenerateVideosOperation, Modality } from "@google/genai";
import { ImageFile } from '../../types';
import { getGeminiClient } from '../apiClient';

export const generateVideoSceneSuggestions = async (
  image: ImageFile,
  gender: string,
  requestText: string,
  promptTemplate: string,
  model: string = 'gemini-2.5-pro',
): Promise<string[]> => {
  const ai = getGeminiClient();
  const imagePart: Part = { inlineData: { data: image.base64, mimeType: image.mimeType } };

  const filledPrompt = promptTemplate
    .replace('{{requestText}}', requestText)
    .replace('{{gender}}', gender)
    .replace(' bằng {{outputLanguage}}', ''); // Let model infer from prompt language

  const textPart: Part = { text: filledPrompt };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [imagePart, textPart] },
      config: {
        thinkingConfig: {
            thinkingBudget: 32768,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'An array of 4 creative scene suggestions.',
            },
          },
          required: ['suggestions'],
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
    if (!data.suggestions || !Array.isArray(data.suggestions) || data.suggestions.length === 0) {
        throw new Error('API returned invalid format for suggestions.');
    }

    return data.suggestions;

  } catch (error) {
    console.error("Error generating video scene suggestions:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.geminiFailed:${errorMessage}`);
  }
};

export const enhanceSceneDescription = async (baseDescription: string, model: string = 'gemini-2.5-pro'): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `# ROLE
You are a creative director and cinematic script doctor. Your specialty is transforming simple ideas into visually rich, evocative scenes.

# TASK
Take the user's basic scene description and rewrite it into a single, vivid paragraph suitable for a high-end, photorealistic video generation AI.

# INSTRUCTIONS
1.  **Amplify Atmosphere & Emotion**: Infer the core mood (e.g., nostalgic, serene, confident, tense) and enrich it. Use sensory details: describe the quality of light, the texture of surfaces, subtle sounds, and the overall feeling of the space.
2.  **Introduce Subtle Action & Life**: Animate the scene. Change static states into gentle, natural movements. Instead of "a woman stands," consider "a woman slowly turns her head, a stray strand of hair catching the light."
3.  **Focus on Micro-Expressions**: Describe the character's inner state through their expression. Mention the gaze, a subtle shift in the lips, or a relaxed brow to convey emotion without dramatic gestures.
4.  **Maintain Core Integrity**: CRITICAL: Do not change the fundamental subject, their outfit, the primary location, or the time of day from the original description. Your job is to enhance, not replace.

# OUTPUT FORMAT
- Return **only** the single, enhanced paragraph in natural, cinematic language.
- Do not include any titles, markdown, or introductory phrases like "Here is the enhanced description:".

# BASIC DESCRIPTION TO ENHANCE:
"${baseDescription}"
`;

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
    throw new Error('error.api.safetyBlock');
  }
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error('error.api.noContent');
  }

  const description = response.text;
  if (description) {
    return description.trim();
  }
  throw new Error('error.api.noText');
};


export const enforceVisualPreservation = async (rawRequestText: string, duration: number, cameraAngle: string): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `# ROLE
You are a Visual Preservation Quality Inspector AI.
Your task is to refine and validate the provided text to ensure all visual details from the original image remain accurate, while enhancing realism and cinematic readiness.

# OBJECTIVE
Output a revised paragraph that:
- Maintains 100 % fidelity to the original photo (background, outfit, proportions).
- Allows natural, lifelike motion and expression suitable for video.
- Ensures the scene lasts exactly ${duration} seconds as one continuous shot.

# ENFORCEMENT RULES
1. **Background Fidelity**
   - Keep identical environment type and composition as seen in the image.
   - Preserve materials, surfaces, and lighting direction.
   - Add only subtle dynamic elements (breeze, shifting light) for realism.
2. **Outfit Fidelity**
   - Do not change or simplify clothing.
   - Retain colors, fabrics, folds, embroidery, reflections, and accessories exactly.
3. **Facial Consistency**
   - Preserve the person’s identity, unique facial features (e.g., eye shape, nose, mouth), and bone structure with absolute accuracy. The resemblance must be perfect and unwavering from frame to frame.
   - The subject's face must remain consistent and recognizable throughout the entire video, even during movement or expression changes.
   - Allow natural, subtle micro-expressions (a gentle blink, a slight shift in gaze, the hint of a smile, natural breathing) to prevent a "frozen" or robotic look. However, these expressions must not distort or change the underlying, unique facial features.
4. **Body & Motion Integrity**
   - Maintain real-world body shape and proportions.
   - Permit graceful, realistic movement (turn, step, hair sway) — no distortion.
5. **Lighting & Atmosphere**
   - Keep light direction, softness, and temperature true to the reference.
   - Cinematic enhancements are allowed (slight rim light, volumetric haze) if subtle.
6. **Continuity**
   - The video must remain a single continuous ${duration}s shot — no cuts, teleports, or scene changes.
7. **Camera Framing**
   - The shot must be framed as a '${cameraAngle}'. Ensure the composition reflects this framing instruction.
8. **Subject Exclusivity (CRITICAL)**: The scene must contain **only one person** — the subject from the reference image. Under no circumstances should any other people, figures, crowds, or silhouettes be visible, even blurred in the background. The video must be strictly a solo performance.

# OUTPUT FORMAT
Return one refined descriptive paragraph in English — concise, natural, and ready for cinematic synthesis.

The text to refine is:
${rawRequestText}
`;

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
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
  throw new Error('error.api.noText');
};

export const fuseStyleForCompactPrompt = async (
  refinedRequestText: string,
  stylePreset: any,
  gender: string,
  duration: number
): Promise<string> => {
  const ai = getGeminiClient();

  const prompt = `# ROLE
You are a Compact AI Cinematic Fusion Engine.
# TASK
Your task is to merge the realism from the provided refined text description with the tone and motion from the selected style preset. The output must be a compact, vivid JSON object. Prioritize texture accuracy, lighting mood, and cinematic flow.
# INPUTS
- **Refined Text Description**: ${refinedRequestText}
- **Style Preset Details**: ${JSON.stringify(stylePreset, null, 2)}
- **Gender**: ${gender}
- **Duration**: ${duration} seconds
# FUSION RULES
- **Fidelity over Style**: The core visual elements (outfit, location, subject identity) described in the refined text must be preserved.
- **Lighting from Style Preset**: Adopt the lighting tone and FX from the style preset.
- **Camera from Style Preset**: Use the camera type, movement, and lens specified in the style preset.
- **Emotion Merge**: Blend the emotion from the refined text with the overall mood of the style preset.
- **Duration Fixed**: The duration must be exactly ${duration} seconds.
# OUTPUT FORMAT
Return a single, valid JSON object that strictly adheres to the provided schema. Extract and summarize information from the 'Refined Text Description' to fill in the relevant fields. Use the 'Style Preset Details' for the other fields.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          desc: { type: Type.STRING, description: 'A summary of the refinedRequestText.' },
          style: { type: Type.STRING, description: 'The style preset ID.' },
          cam: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              mov: { type: Type.STRING },
              lens: { type: Type.STRING },
            },
          },
          light: {
            type: Type.OBJECT,
            properties: {
              tone: { type: Type.STRING },
              fx: { type: Type.STRING },
            },
          },
          scene: {
            type: Type.OBJECT,
            properties: {
              loc: { type: Type.STRING, description: 'Background location from refinedRequestText.' },
              obj: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Set elements from refinedRequestText.' },
            },
          },
          subj: {
            type: Type.OBJECT,
            properties: {
              desc: { type: Type.STRING, description: 'Character description from refinedRequestText.' },
              pose: { type: Type.STRING, description: 'Character pose from refinedRequestText.' },
              act: { type: Type.STRING, description: 'Character action from refinedRequestText.' },
              outfit: { type: Type.STRING, description: 'Outfit description from refinedRequestText.' },
            },
          },
          vfx: {
            type: Type.OBJECT,
            properties: {
              env: { type: Type.STRING },
              fx: { type: Type.STRING },
            },
          },
          snd: {
            type: Type.OBJECT,
            properties: {
              amb: { type: Type.STRING },
              tone: { type: Type.STRING },
            },
          },
          dur: { type: Type.STRING, description: 'Duration in seconds, e.g., "8s".' },
          col: { type: Type.STRING, description: 'Color palette from style preset.' },
        },
      },
    },
  });

  const jsonText = response.text;
  if (!jsonText) {
      throw new Error('error.api.noContent');
  }
  JSON.parse(jsonText.trim());
  return jsonText.trim();
};

export type GRWMMode = 'casual' | 'office' | 'date' | 'travel';

export const generateGRWMVideoPrompt = async (
  outfitImage: ImageFile,
  mode: GRWMMode,
  outfitDescription: string
): Promise<string> => {
  const ai = getGeminiClient();
  const imagePart: Part = { inlineData: { data: outfitImage.base64, mimeType: outfitImage.mimeType } };

  const prompt = `
# ROLE
You are a creative director for a short-form video platform, specializing in "Get Ready With Me" (GRWM) content.

# TASK
Generate a detailed, scene-by-scene JSON plan for a 15-20 second vertical video. The video's theme is a GRWM for a specific occasion, featuring a user-provided outfit.

# INPUTS
- **Outfit Image**: An image of the clothing to be featured.
- **Outfit Description**: "${outfitDescription}"
- **Occasion/Mode**: "${mode}"

# INSTRUCTIONS
1.  **Analyze the Outfit**: Based on the image and description, understand the style, fabric, and key features of the outfit.
2.  **Structure the Video**: Create a JSON object representing a sequence of 4-5 distinct scenes.
3.  **Scene Content**: Each scene object must include:
    - \`scene_number\`: An integer (1, 2, 3, etc.).
    - \`duration_seconds\`: Estimated duration for the scene (e.g., 3-5 seconds).
    - \`visual_description\`: A detailed description of the action, camera shot, and setting. The setting should match the "${mode}" occasion (e.g., a bedroom for 'casual', a modern apartment for 'office').
    - \`outfit_focus\`: How the outfit is featured in the scene (e.g., "Close-up on the texture of the shirt," "Full outfit shown as she spins").
    - \`audio_cue\`: A suggestion for the background music or sound effect (e.g., "upbeat pop music," "soft lo-fi beat," "sound of a zipper").
4.  **Continuity**: Ensure the scenes flow logically, telling a mini-story of getting ready. Start with preparation, build to revealing the outfit, and end with a final look.
5.  **JSON Format**: The final output must be a single, valid JSON object with a root key "video_plan" containing an array of scene objects. Do not include any markdown or explanatory text outside the JSON.
`;
  const textPart: Part = { text: prompt };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          video_plan: {
            type: Type.ARRAY,
            description: "An array of scene objects for the GRWM video.",
            items: {
              type: Type.OBJECT,
              properties: {
                scene_number: { type: Type.INTEGER },
                duration_seconds: { type: Type.INTEGER },
                visual_description: { type: Type.STRING },
                outfit_focus: { type: Type.STRING },
                audio_cue: { type: Type.STRING },
              },
              required: ["scene_number", "duration_seconds", "visual_description", "outfit_focus", "audio_cue"]
            }
          }
        },
        required: ["video_plan"]
      },
    },
  });

  const jsonText = response.text?.trim();
  if (!jsonText) {
    throw new Error('error.api.noContent');
  }

  const parsedJson = JSON.parse(jsonText);
  return JSON.stringify(parsedJson, null, 2);
};

export const summarizeGRWMVideoPrompt = async (
  jsonPlan: string
): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `
# ROLE
You are an expert video prompt writer. Your task is to convert a structured JSON video plan into a single, cohesive, and descriptive paragraph that a video generation AI can understand.

# TASK
Summarize the following JSON scene-by-scene plan into a compelling, continuous narrative prompt.

# JSON PLAN
\`\`\`json
${jsonPlan}
\`\`\`

# INSTRUCTIONS
1.  **Synthesize, Don't List**: Do not just list the scenes. Weave them together into a flowing description of the entire video from start to finish.
2.  **Focus on Visuals**: Emphasize the visual actions, camera shots, and key moments. Mention the setting and the mood.
3.  **Incorporate Outfit Details**: Ensure the description clearly highlights how the outfit is featured throughout the video.
4.  **Be Concise but Evocative**: The final prompt should be a single, dense paragraph. Use strong verbs and descriptive adjectives.
5.  **Output Format**: Return only the final paragraph as plain text. Do not include any titles, markdown, or introductory phrases.

# EXAMPLE OUTPUT
"A fast-paced 'Get Ready With Me' video begins with a close-up of a vibrant floral dress laid out on a bed. The scene transitions to a medium shot of a woman smiling as she zips up the dress. This is followed by a dynamic shot of her spinning in a sunlit room, the dress flowing around her. The video ends with a confident full-body shot of her by a window, ready to go out, holding a small handbag that complements the outfit."
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  if (response.promptFeedback?.blockReason) {
    throw new Error('error.api.safetyBlock');
  }
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error('error.api.noContent');
  }

  const summary = response.text;
  if (summary) {
    return summary.trim();
  }
  
  throw new Error('error.api.noText');
};

export const generateGRWMVideoSequencePrompts = async (
  images: ImageFile[],
): Promise<string[]> => {
  const ai = getGeminiClient();
  
  const imageParts: Part[] = images.map(image => ({
    inlineData: {
      data: image.base64,
      mimeType: image.mimeType,
    },
  }));

  const prompt = `
# ROLE
You are a creative director for a cinematic fashion lookbook video and an expert in structuring prompts as JSON.

# TASK
Animate ${images.length} uploaded reference images into a dynamic fashion lookbook video sequence. For EACH image, generate a single, valid JSON object that describes a video scene.

# CRITICAL RULE: ABSOLUTE VISUAL CONSISTENCY
Preserve ALL elements from each reference image with 100% accuracy. This includes: model's face, hairstyle, outfit, fabric texture, accessories, shoes, jewelry, lighting, background, color tone, and composition. The ONLY change should be the introduction of subtle, natural motion.

# MOTION LIBRARY
Use the following library to generate varied and stylish movements.

## Actions
- walk forward confidently
- turn around gracefully
- fix sleeve while stepping
- brush hair back with hand
- shift pose from one leg to another
- adjust handbag strap
- slow spin to show outfit
- look over shoulder and smile subtly
- play with jewelry or ring
- pose with one hand on hip
- walk past camera and glance sideways
- slight catwalk step with fabric motion

## Expressions
- confident
- elegant
- neutral runway
- soft smile
- serious focus
- graceful
- playful
- chic calm

## Camera Movements
- slow_tracking_right
- slow_tracking_left
- orbit_around_model
- follow_walk
- tilt_up_from_shoes_to_face
- handheld_follow
- soft_dolly_in
- slide_around_side

# INSTRUCTIONS FOR EACH IMAGE
1.  Analyze the reference image.
2.  From the motion library, randomly select ONE action, ONE expression, and ONE camera movement.
3.  Construct a JSON object with the following keys. Adhere strictly to this structure.
    -   \`"scene"\`: (string) Always set to \`"lookbook_scene"\`.
    -   \`"style"\`: (string) Always set to \`"cinematic fashion lookbook"\`.
    -   \`"description"\`: (string) A brief, general overview of the scene, e.g., "A cinematic fashion lookbook shot featuring a confident model.".
    -   \`"action"\`: (string) The randomly selected action from the library.
    -   \`"expression"\`: (string) The randomly selected expression from the library.
    -   \`"camera_movement"\`: (string) The randomly selected camera movement from the library.
    -   \`"motion_style"\`: (string) A descriptive phrase like \`"fluid and visually balanced"\`.
    -   \`"preserve"\`: (array of strings) A list of elements to preserve exactly, including \`"outfit details", "hairstyle", "accessories", "shoes", "lighting", "background", "color tone"\`.
    -   \`"negative_prompt"\`: (array of strings) A list of restrictions, including \`"do not alter clothing, hairstyle, or accessories", "no outfit color changes", "no distortion", "no artificial filters", "no exaggerated lens flares"\`.

# FINAL OUTPUT FORMAT
Return a single valid JSON array. The array must contain one JSON object for each of the ${images.length} input images, each following the structure defined in the instructions. Do not wrap the array in another object.
`;
  const textPart: Part = { text: prompt };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [...imageParts, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        description: "An array of video prompt JSON objects, one for each input image.",
        items: {
          type: Type.OBJECT,
          properties: {
            scene: { type: Type.STRING },
            style: { type: Type.STRING },
            description: { type: Type.STRING },
            action: { type: Type.STRING },
            expression: { type: Type.STRING },
            camera_movement: { type: Type.STRING },
            motion_style: { type: Type.STRING },
            preserve: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            negative_prompt: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["scene", "style", "description", "action", "expression", "camera_movement", "motion_style", "preserve", "negative_prompt"]
        }
      },
    },
  });

  const jsonText = response.text?.trim();
  if (!jsonText) {
    throw new Error('error.api.noContent');
  }

  const parsedJson = JSON.parse(jsonText);
  if (!Array.isArray(parsedJson)) {
      throw new Error('API returned invalid format for GRWM sequence prompts.');
  }

  if (parsedJson.length !== images.length) {
      throw new Error(`API returned ${parsedJson.length} prompts, but ${images.length} images were provided.`);
  }

  return parsedJson.map((promptObj: object) => JSON.stringify(promptObj));
};

export const generateVideo = async (
  faceImage: ImageFile,
  prompt: string,
  onStatusUpdate: (message: string) => void,
  model: string = 'veo-3.1-fast-generate-preview'
): Promise<string> => {
  const ai = getGeminiClient();
  try {
    onStatusUpdate('Initiating video generation...');
    let operation = await ai.models.generateVideos({
      model: model,
      prompt: prompt,
      image: {
        imageBytes: faceImage.base64,
        mimeType: faceImage.mimeType,
      },
      config: {
        numberOfVideos: 1,
        aspectRatio: '9:16',
      }
    });

    onStatusUpdate('Processing video, this may take a few minutes...');
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      onStatusUpdate('Checking video status...');
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    onStatusUpdate('Finalizing video...');
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      console.error("Video generation finished but no download link was provided.", operation);
      throw new Error("Failed to get video download link.");
    }

    return downloadLink;
  } catch (error) {
    console.error("Error generating video with Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "error.unknown";
    throw new Error(errorMessage.startsWith('error.') ? errorMessage : `error.api.geminiFailed:${errorMessage}`);
  }
};

const STYLE_BEHAVIORS: Record<string, string> = {
  lookbook: `
    - **Focus:** Emphasize the clothing's fabric, drape, and texture.
    - **Motion:** Use graceful, slow, and deliberate movements like a gentle turn, a slow walk, or fabric catching a light breeze. Poses should be elegant and model-esque.
    - **Camera:** Employ classic fashion photography compositions (e.g., rule of thirds, centered subject). Use slow pans, tilts, or static shots.
    - **Lighting:** Soft, diffused, and flattering light, similar to a professional studio or golden hour.
    - **Emotion:** Maintain a neutral, poised, or slightly aloof expression. The mood is chic and sophisticated.`,
  storytelling: `
    - **Focus:** Create a clear narrative arc across the scenes. Each prompt should build on the last.
    - **Motion:** Actions should have a purpose and drive the story forward (e.g., picking up an object, looking towards something specific, reacting to an event).
    - **Camera:** Use camera movements with intent (e.g., a push-in to build tension, a pull-back to reveal the environment). Follow the character's emotional journey.
    - **Lighting:** Use light and shadow to create mood and atmosphere that supports the story (e.g., dramatic shadows for mystery, warm light for a happy memory).
    - **Emotion:** Show a clear progression of emotion. Expressions should be authentic and reflect the character's inner state.`,
  kids_animation: `
    - **Focus:** Bright, simple, and engaging actions.
    - **Motion:** Exaggerated, bouncy, and energetic movements. Actions should be large and easy to understand (e.g., jumping, laughing, spinning).
    - **Camera:** Dynamic and fun camera work with quick cuts, zooms, and playful angles.
    - **Lighting:** Bright, high-key lighting with saturated, vibrant colors. Avoid complex shadows.
    - **Emotion:** Expressive and exaggerated emotions like pure joy, surprise, or silliness. Big smiles and wide eyes.`,
  cinematic: `
    - **Focus:** Achieve film-grade realism in every aspect.
    - **Motion:** Natural, subtle, and realistic human movements. Actions should feel unscripted and authentic.
    - **Camera:** Use classic filmmaking techniques—motivated camera moves, thoughtful composition, and controlled focus pulls. Emulate high-end cinema cameras (ARRI, RED).
    - **Lighting:** Dramatic, motivated lighting that shapes the subject and environment. Use techniques like chiaroscuro, rim lighting, and lens flares to create depth.
    - **Emotion:** Convey complex and nuanced emotions through micro-expressions and subtle body language.`,
  documentary: `
    - **Focus:** Capture a sense of realism and authenticity, as if observing a real moment.
    - **Motion:** Unscripted, natural actions. Avoid posed or overly stylized movements.
    - **Camera:** Simulate a handheld camera with subtle, organic movements or a static tripod shot. Use observational framing.
    - **Lighting:** Utilize available, natural light. The lighting should feel authentic to the environment, not staged.
    - **Emotion:** Candid and genuine expressions. The mood should be grounded and observational.`,
  advertising: `
    - **Focus:** Highlight a product or lifestyle in an aspirational, high-energy way.
    - **Motion:** Dynamic, confident, and impactful movements. Quick actions and heroic poses.
    - **Camera:** Use fast-paced editing, gimbal tracking shots, low-angle "hero" shots, and speed ramps to create excitement.
    - **Lighting:** High-contrast, polished, and stylized commercial lighting. Product highlights and clean lens flares are common.
    - **Emotion:** Positive, aspirational, and confident expressions. Direct eye contact with the camera is often`,
};

export type VideoStyle = 'lookbook' | 'storytelling' | 'kids_animation' | 'cinematic' | 'documentary' | 'advertising';
export interface Scene {
  scene: number;
  prompt: string;
}
interface VideoContinuityParams {
    basePrompt: string;
    sceneCount: number;
    duration: number;
    style: VideoStyle;
    image_mode: 'single' | 'multi' | 'brainstorm';
    images: (ImageFile | null)[];
    model?: string;
}
interface VideoVariationParams {
    basePrompt: string;
    variationCount: number;
    duration: number;
    style: VideoStyle;
    model?: string;
}

export const generateVideoContinuitySequence = async (params: VideoContinuityParams): Promise<Scene[]> => {
    const ai = getGeminiClient();
    
    const prompt = `
# ROLE
You are an AI Video Scriptwriter specialized in creating coherent, multi-scene video sequences.

# TASK
Based on the user's request, generate a sequence of ${params.sceneCount} video scene prompts. Each scene should logically follow the previous one, maintaining continuity in style, narrative, and subject matter.

# INSTRUCTIONS
1.  **Adhere to Style**: The entire sequence must conform to a '${params.style}' aesthetic.
2.  **Maintain Continuity**: Ensure a smooth transition from one scene to the next. If it's a story, progress the narrative. If it's a lookbook, showcase different aspects of the subject in a cohesive manner.
3.  **Incorporate Base Prompt**: Use the following as the core idea for the sequence: "${params.basePrompt}".
4.  **Duration**: Each scene prompt should be written to be achievable within a ${params.duration}-second shot.
5.  **Image Mode**: The user has selected '${params.image_mode}' mode. 
    - If 'single' or 'multi', the prompts should describe actions for the character(s) in the provided image(s).
    - If 'brainstorm', you have more creative freedom based on the prompt.

# OUTPUT FORMAT
Return a valid JSON object with a single key "scenes", which is an array of strings. Each string is a detailed prompt for one scene. The array must contain exactly ${params.sceneCount} elements.
    `;

    const imageParts: Part[] = params.images.filter((img): img is ImageFile => img !== null).map(img => ({
        inlineData: { data: img.base64, mimeType: img.mimeType }
    }));
    
    const textPart: Part = { text: prompt };

    const response = await ai.models.generateContent({
        model: params.model || 'gemini-2.5-pro',
        contents: imageParts.length > 0 ? { parts: [...imageParts, textPart] } : textPart.text,
        config: {
            thinkingConfig: {
                thinkingBudget: 32768,
            },
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    scenes: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                },
                required: ['scenes'],
            },
        },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
      throw new Error('error.api.noContent');
    }

    const data = JSON.parse(jsonText);
    if (!data.scenes || !Array.isArray(data.scenes)) {
        throw new Error('API returned invalid format for scene sequence.');
    }
    
    return data.scenes.map((prompt: string, index: number) => ({
        scene: index + 1,
        prompt: prompt,
    }));
};

export const generateVideoPromptVariations = async (params: VideoVariationParams): Promise<Scene[]> => {
    const ai = getGeminiClient();

    const prompt = `
# ROLE
You are an AI brainstorming partner for a creative director.

# TASK
Generate ${params.variationCount} creative and distinct variations of a base video prompt. Each variation should explore a different interpretation or angle of the core idea while adhering to the specified style.

# INSTRUCTIONS
1.  **Base Prompt**: The core idea is: "${params.basePrompt}".
2.  **Style Adherence**: All variations must strictly follow the '${params.style}' aesthetic. Refer to these style guidelines: ${STYLE_BEHAVIORS[params.style] || 'General cinematic principles apply.'}
3.  **Creative Diversity**: Each variation should be unique. Consider changing:
    - Camera angle (close-up, wide shot)
    - Character's micro-action or emotion
    - Time of day or lighting mood
    - A subtle narrative twist
4.  **Duration**: Each scene prompt must be suitable for a ${params.duration}-second video clip.
5.  **Maintain Core Elements**: Do not change the fundamental subject or setting from the base prompt unless it's a creative reinterpretation.

# OUTPUT FORMAT
Return a valid JSON object with a single key "variations", which is an array of strings. Each string is a detailed prompt for one variation. The array must contain exactly ${params.variationCount} elements.
    `;

    const response = await ai.models.generateContent({
        model: params.model || 'gemini-2.5-pro',
        contents: prompt,
        config: {
            thinkingConfig: {
                thinkingBudget: 32768,
            },
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    variations: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                },
                required: ['variations'],
            },
        },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
      throw new Error('error.api.noContent');
    }

    const data = JSON.parse(jsonText);
    if (!data.variations || !Array.isArray(data.variations)) {
        throw new Error('API returned invalid format for prompt variations.');
    }
    
    return data.variations.map((prompt: string, index: number) => ({
        scene: index + 1,
        prompt: prompt,
    }));
};
