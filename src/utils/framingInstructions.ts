import { en } from '../locales/en';

/**
 * Resolves camera framing instructions in English for AI prompt generation.
 *
 * Prompts sent to Gemini image models remain 100% English even when the user
 * interface is running in Vietnamese or other locales.
 */
export const getEnglishFramingInstruction = (cameraView: string | undefined): string => {
  if (!cameraView || cameraView === 'default') {
    return 'Use default framing provided by the model.';
  }
  const instructions = en.framingInstructions as Record<string, string>;
  return instructions[cameraView] || 'Use default framing provided by the model.';
};
