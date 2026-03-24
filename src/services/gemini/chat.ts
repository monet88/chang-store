import { Part, Modality } from "@google/genai";
import { ImageFile } from '../../types';
import { getGeminiClient } from '../apiClient';

export interface RefinementHistoryItem {
  prompt: string;
  timestamp: number;
}

export interface ImageChatSession {
  sendRefinement(prompt: string, currentImage: ImageFile): Promise<ImageFile>;
  getHistory(): RefinementHistoryItem[];
  reset(): void;
}

/**
 * Create a chat session for iterative image refinement using Gemini.
 * Maintains conversation history client-side since Gemini API doesn't have native chat support for image generation.
 */
export function createImageChatSession(model: string = 'gemini-2.5-flash-image'): ImageChatSession {
  const ai = getGeminiClient();
  let history: RefinementHistoryItem[] = [];
  let conversationParts: Part[] = []; // Track all parts (images + prompts) for context

  return {
    async sendRefinement(prompt: string, currentImage: ImageFile): Promise<ImageFile> {
      // Add current image and prompt to conversation
      const imagePart: Part = {
        inlineData: {
          data: currentImage.base64,
          mimeType: currentImage.mimeType,
        }
      };
      const textPart: Part = { text: prompt };

      // Build full conversation context
      conversationParts.push(imagePart, textPart);

      const response = await ai.models.generateContent({
        model,
        contents: { parts: conversationParts },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      // Check for safety blocks
      if (response.promptFeedback?.blockReason) {
        throw new Error('error.api.safetyBlock');
      }

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('error.api.safetyBlock');
      }

      const candidate = response.candidates[0];

      // Check finish reason
      const finishReason = candidate.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
        throw new Error('error.api.safetyBlock');
      }

      const content = candidate.content;

      if (!content?.parts) {
        throw new Error('error.api.noContent');
      }

      // Extract image from response
      for (const part of content.parts) {
        if (part.inlineData) {
          // Add to history
          history.push({ prompt, timestamp: Date.now() });

          return {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          };
        }
      }

      throw new Error('error.api.noImageInParts');
    },

    getHistory(): RefinementHistoryItem[] {
      return [...history];
    },

    reset(): void {
      history = [];
      conversationParts = [];
    }
  };
}
