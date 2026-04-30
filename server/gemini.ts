import { GoogleGenAI, Modality, type Part } from '@google/genai';

function getApiKey(): string {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error('API_KEY environment variable is not set');
  }
  return key;
}

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return client;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
}

export interface ImageResult {
  base64: string;
  mimeType: string;
}

export interface GenerateImageParams {
  images: ImageInput[];
  prompt: string;
  model?: string;
  numberOfImages?: number;
}

function parseDataUrl(dataUrl: string): ImageInput {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: 'image/png', base64: dataUrl };
}

export async function generateImage(params: GenerateImageParams): Promise<ImageResult[]> {
  const ai = getGeminiClient();
  const model = params.model || 'gemini-2.5-flash-image-preview';

  const imageParts: Part[] = params.images.map((img) => ({
    inlineData: {
      data: img.base64,
      mimeType: img.mimeType,
    },
  }));

  const contentParts: Part[] = [...imageParts, { text: params.prompt }];

  const results: ImageResult[] = [];

  for (let i = 0; i < (params.numberOfImages || 1); i++) {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: contentParts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    if (response.promptFeedback?.blockReason) {
      console.error('[GEMINI] Safety block:', JSON.stringify(response.promptFeedback));
      throw new Error('SAFETY_BLOCK');
    }

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('NO_CANDIDATES');
    }

    const candidate = response.candidates[0];
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
      throw new Error('SAFETY_BLOCK');
    }

    const content = candidate.content;
    if (!content?.parts || content.parts.length === 0) {
      throw new Error('NO_CONTENT');
    }

    for (const part of content.parts) {
      if (part.inlineData) {
        results.push({
          base64: part.inlineData.data || '',
          mimeType: part.inlineData.mimeType || 'image/png',
        });
        break;
      }
    }
  }

  return results;
}

export async function editImage(
  personImage: string,
  garmentImage: string,
  prompt: string,
): Promise<ImageResult> {
  const person = parseDataUrl(personImage);
  const garment = parseDataUrl(garmentImage);

  const results = await generateImage({
    images: [person, garment],
    prompt,
    numberOfImages: 1,
  });

  if (results.length === 0) {
    throw new Error('NO_RESULTS');
  }

  return results[0];
}

export async function generateImagesFromBatch(
  imageStrings: string[],
  prompt: string,
  numberOfImages?: number,
): Promise<ImageResult[]> {
  const images = imageStrings.map(parseDataUrl);
  return generateImage({ images, prompt, numberOfImages: numberOfImages || imageStrings.length });
}
