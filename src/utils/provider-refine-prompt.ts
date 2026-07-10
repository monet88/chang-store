import { UpscaleQuality } from '../types';
import { buildUpscalePromptTable } from './upscale-prompt-builder';

/**
 * Preservation-first prompt helpers for provider-studio post-generation tools.
 *
 * Provider edit endpoints are stateless (no server chat history), so refine and
 * upscale work exactly like the Gemini client-side flow: feed the current
 * result image back as the source with a preservation-wrapped instruction.
 * These are static, trusted text wrappers — the user instruction is the only
 * untrusted input and is validated at the service layer.
 */

/**
 * Wrap a user refine instruction so the model applies only the requested change
 * and preserves everything else (mirrors the Gemini chat-refine behaviour).
 */
export const buildProviderRefinePrompt = (instruction: string): string => {
    const trimmed = instruction.trim();
    return [
        'Edit the provided image applying ONLY the change described below.',
        'Preserve everything else exactly: subject identity, pose, composition, lighting, colors, and background unless the change explicitly requires altering them.',
        'Do not add text, logos, watermarks, or extra people. Keep photorealistic, professional quality.',
        `Requested change: ${trimmed}`,
    ].join('\n\n');
};

/**
 * Preservation-first upscale prompts, mirroring the Gemini studio's text. Kept
 * here as shared constants (text only) so provider hooks never import the
 * Gemini image service. Composed from the shared upscale builder with the
 * `subject` noun (provider results are not always people).
 */
export const PROVIDER_UPSCALE_PROMPTS: Record<UpscaleQuality, string> = buildUpscalePromptTable('subject');
