import type { ImageChatSession, editImage } from '../services/imageEditingService';
import { buildProviderRefinePrompt } from './provider-refine-prompt';

/**
 * Provider edits are stateless, so a GPT refine is one edit request carrying the
 * current image plus a preservation wrapper — there is no server-side turn
 * history (issue #152, Decision 5). Shaped as a chat session so the Gemini
 * refine lifecycle keeps working unchanged on the other lane.
 */
export const createSingleShotRefineSession = (
  editImageFn: typeof editImage,
  model: string,
): ImageChatSession => ({
  sendRefinement: async (prompt: string, currentImage) => {
    const [refined] = await editImageFn(
      { images: [currentImage], prompt: buildProviderRefinePrompt(prompt) },
      model,
      { onStatusUpdate: () => {} },
    );
    return refined;
  },
  getHistory: () => [],
  reset: () => {},
});
