/**
 * Negative-prompt builder — single source of truth for the avoid-sentence both
 * image lanes append to a request prompt.
 *
 * Neither lane has a real negative field (the Gemini SDK call takes a text
 * prompt; OpenAI's `/images/edits` has no such parameter), so the user's
 * negative prompt becomes one sentence of the prompt itself. Kept here so the
 * Gemini service and the GPT lane can never drift into two different wordings.
 */

/** Append the avoid-sentence; an empty/blank negative prompt changes nothing. */
export const appendNegativePrompt = (prompt: string, negativePrompt?: string): string => {
  const avoid = negativePrompt?.trim();
  return avoid ? `${prompt} Negative prompt: strictly avoid including ${avoid}.` : prompt;
};
