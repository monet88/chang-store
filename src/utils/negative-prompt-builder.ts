/**
 * Negative-prompt builder — single source of truth for the avoid-sentence both
 * image lanes send.
 *
 * Neither lane has a real negative field (the Gemini SDK call takes a text
 * prompt; OpenAI's `/images/edits` has no such parameter), so the user's
 * negative prompt becomes one sentence of the request prompt. Kept here so the
 * Gemini service and the GPT lane can never drift into two different wordings.
 */

/** The avoid-sentence alone, or `null` when nothing was requested. */
export const negativePromptSentence = (negativePrompt?: string): string | null => {
  const avoid = negativePrompt?.trim();
  return avoid ? `Negative prompt: strictly avoid including ${avoid}.` : null;
};

/** Append the avoid-sentence; an empty/blank negative prompt changes nothing. */
export const appendNegativePrompt = (prompt: string, negativePrompt?: string): string => {
  const sentence = negativePromptSentence(negativePrompt);
  return sentence ? `${prompt} ${sentence}` : prompt;
};
