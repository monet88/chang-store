import { describe, it, expect } from 'vitest';
import {
  buildSingleImageEditPrompt,
  buildMultiImageEditPrompt,
  buildQwenSingleImageEditPrompt,
  buildQwenMultiImageEditPrompt,
} from '@/utils/ai-editor-prompt-builder';

describe('ai-editor-prompt-builder', () => {
  describe('buildQwenSingleImageEditPrompt', () => {
    it('builds instruction header and preserves user prompt verbatim', () => {
      const prompt = 'Change the background to a minimalist studio with soft warm light';
      const result = buildQwenSingleImageEditPrompt(prompt);

      expect(result).toContain('# INSTRUCTION: LOCAL QWEN IMAGE EDITING');
      expect(result).toContain(`## USER REQUEST:\n${prompt}`);
      expect(result).toContain('## OUTPUT:\nReturn the edited image as the final result — exactly one image, not a grid, collage, or multi-panel sheet.');
    });

    it('keeps user prompt authoritative and avoids injecting cloud preservation rules', () => {
      const prompt = 'Turn daytime into cyberpunk night with neon rain';
      const result = buildQwenSingleImageEditPrompt(prompt);

      expect(result).not.toContain('## EDIT RULES:');
      expect(result).not.toContain('Keep subject identity, pose, framing');
      expect(result).not.toContain('no beauty retouching');
      expect(result).not.toContain('Change nothing else');
    });
  });

  describe('buildQwenMultiImageEditPrompt', () => {
    it('renders image roles and preserves user prompt verbatim with mention roles', () => {
      const prompt = 'Replace the jacket on @img1 with the trench coat from @img2';
      const imageRoles = '- Image 1 is @img1\n- Image 2 is @img2';
      const result = buildQwenMultiImageEditPrompt(prompt, imageRoles);

      expect(result).toContain('# INSTRUCTION: LOCAL QWEN MULTI-IMAGE EDITING');
      expect(result).toContain(`## IMAGE ROLES:\n${imageRoles}`);
      expect(result).toContain(`## USER REQUEST:\n${prompt}`);
      expect(result).toContain('## OUTPUT:\nReturn the final edited image as the single result — exactly one image, not a grid, collage, or multi-panel sheet.');
    });

    it('renders minimal image roles when sent without mentions', () => {
      const prompt = 'Combine these three photos into a catalog look';
      const imageRoles = '- Image 1\n- Image 2\n- Image 3';
      const result = buildQwenMultiImageEditPrompt(prompt, imageRoles);

      expect(result).toContain('# INSTRUCTION: LOCAL QWEN MULTI-IMAGE EDITING');
      expect(result).toContain(`## IMAGE ROLES:\n${imageRoles}`);
      expect(result).not.toContain('@img');
      expect(result).toContain(`## USER REQUEST:\n${prompt}`);
      expect(result).not.toContain('Keep subject identity, pose, framing');
    });
  });

  describe('cloud prompt builders', () => {
    it('includes strict edit rules in buildSingleImageEditPrompt', () => {
      const prompt = 'Adjust collar alignment';
      const result = buildSingleImageEditPrompt(prompt);

      expect(result).toContain('# INSTRUCTION: IMAGE EDITING');
      expect(result).toContain('## EDIT RULES:');
      expect(result).toContain('Keep subject identity, pose, framing');
    });

    it('includes strict multi-image edit rules in buildMultiImageEditPrompt', () => {
      const prompt = 'Swap shoes';
      const imageRoles = '- Image 1 is @img1\n- Image 2 is @img2';
      const result = buildMultiImageEditPrompt(prompt, imageRoles);

      expect(result).toContain('# INSTRUCTION: MULTI-IMAGE EDITING');
      expect(result).toContain(`## IMAGE ROLES:\n${imageRoles}`);
      expect(result).toContain('Integrate the referenced content as one photograph');
    });
  });
});
