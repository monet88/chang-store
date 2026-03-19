/**
 * Characterization Tests for Virtual Try-On Prompt Builder
 *
 * Tests verify that the builder output contains expected sections and rules
 * without changing any prompt semantics. Locks current structure for safe refactoring.
 */

import { describe, it, expect } from 'vitest';
import { buildVirtualTryOnPrompt, VirtualTryOnFormState } from '@/utils/virtual-try-on-prompt-builder';

describe('buildVirtualTryOnPrompt', () => {
  const defaultFormState: VirtualTryOnFormState = {
    subjectImageCount: 1,
    clothingImageCount: 1,
    extraPrompt: '',
    backgroundPrompt: '',
    numImages: 1,
  };

  const dualGarmentFormState: VirtualTryOnFormState = {
    subjectImageCount: 1,
    clothingImageCount: 2,
    extraPrompt: '',
    backgroundPrompt: '',
    numImages: 1,
  };

  describe('structure - required sections', () => {
    it('should contain IMAGE ROLES section', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('## 1. IMAGE ROLES');
    });

    it('should contain ABSOLUTE HIGHEST PRIORITY section', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('## 2. ABSOLUTE HIGHEST PRIORITY');
    });

    it('should contain INTEGRATION RULES section', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('## 4. INTEGRATION RULES (MUST FOLLOW)');
    });

    it('should contain STRICT NEGATIVE CONSTRAINTS section', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('## 7. STRICT NEGATIVE CONSTRAINTS (DO NOT DO)');
    });

    it('should contain all 7 numbered sections in order', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      const sections = [
        '## 1. IMAGE ROLES',
        '## 2. ABSOLUTE HIGHEST PRIORITY',
        '## 3. CORE TASK',
        '## 4. INTEGRATION RULES (MUST FOLLOW)',
        '## 5. POSE & EXPRESSION',
        '## 6. BACKGROUND',
        '## 7. STRICT NEGATIVE CONSTRAINTS (DO NOT DO)',
      ];

      sections.forEach(section => {
        expect(prompt).toContain(section);
      });

      // Verify order
      let lastIndex = -1;
      sections.forEach(section => {
        const currentIndex = prompt.indexOf(section);
        expect(currentIndex).toBeGreaterThan(lastIndex);
        lastIndex = currentIndex;
      });
    });
  });

  describe('integration rules - critical styling', () => {
    it('should contain UNTUCKED rule in integration rules', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('MUST always be worn UNTUCKED');
    });

    it('should have UNTUCKED rule before negative constraints', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      const untuckedIndex = prompt.indexOf('MUST always be worn UNTUCKED');
      const negativeConstraintsIndex = prompt.indexOf('## 7. STRICT NEGATIVE CONSTRAINTS');
      expect(untuckedIndex).toBeLessThan(negativeConstraintsIndex);
    });

    it('should contain "hanging naturally OUTSIDE the pants/skirt waistband"', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('hanging naturally OUTSIDE the pants/skirt waistband');
    });

    it('should contain "NEVER tuck any top into the bottom garment"', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('NEVER tuck any top into the bottom garment');
    });
  });

  describe('negative constraints - critical rule', () => {
    it('should contain DO NOT tuck constraint in negative section', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      const negativeIndex = prompt.indexOf('## 7. STRICT NEGATIVE CONSTRAINTS');
      const tuckConstraint = prompt.indexOf('Do NOT tuck tops/shirts/blouses into pants or skirts');
      expect(tuckConstraint).toBeGreaterThan(negativeIndex);
    });

    it('should contain "tops must ALWAYS hang freely outside the waistband"', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('tops must ALWAYS hang freely outside the waistband');
    });
  });

  describe('form state integration - extraPrompt', () => {
    it('should append extraPrompt to integration rules when provided', () => {
      const stateWithExtra = {
        ...defaultFormState,
        extraPrompt: 'Make the outfit have a vintage aesthetic',
      };
      const prompt = buildVirtualTryOnPrompt(stateWithExtra);
      expect(prompt).toContain('Make the outfit have a vintage aesthetic');
      expect(prompt).toContain('## 4. INTEGRATION RULES (MUST FOLLOW)');
    });

    it('should inject extraPrompt as a bullet point in integration rules', () => {
      const stateWithExtra = {
        ...defaultFormState,
        extraPrompt: 'Custom styling instruction',
      };
      const prompt = buildVirtualTryOnPrompt(stateWithExtra);
      // Should be added as a bullet after other rules
      expect(prompt).toMatch(/- Custom styling instruction/);
    });

    it('should not append extraPrompt when empty or whitespace only', () => {
      const stateEmpty = { ...defaultFormState, extraPrompt: '' };
      const stateWhitespace = { ...defaultFormState, extraPrompt: '   ' };

      const promptEmpty = buildVirtualTryOnPrompt(stateEmpty);
      const promptWhitespace = buildVirtualTryOnPrompt(stateWhitespace);

      // Should not have extra bullet points
      const emptyLines = promptEmpty.split('\n').filter(line => line.trim().startsWith('- ')).length;
      const whitespaceLines = promptWhitespace.split('\n').filter(line => line.trim().startsWith('- ')).length;

      expect(emptyLines).toBe(whitespaceLines);
    });

    it('should trim whitespace from extraPrompt', () => {
      const stateWithWhitespace = {
        ...defaultFormState,
        extraPrompt: '   Trimmed instruction   ',
      };
      const prompt = buildVirtualTryOnPrompt(stateWithWhitespace);
      expect(prompt).toContain('Trimmed instruction');
      expect(prompt).not.toContain('   Trimmed instruction   ');
    });
  });

  describe('form state integration - backgroundPrompt', () => {
    it('should use backgroundPrompt when provided', () => {
      const stateWithBg = {
        ...defaultFormState,
        backgroundPrompt: 'Minimalist white studio',
      };
      const prompt = buildVirtualTryOnPrompt(stateWithBg);
      expect(prompt).toContain('Minimalist white studio');
    });

    it('should render background modification instruction when backgroundPrompt provided', () => {
      const stateWithBg = {
        ...defaultFormState,
        backgroundPrompt: 'Urban street setting',
      };
      const prompt = buildVirtualTryOnPrompt(stateWithBg);
      expect(prompt).toContain('modify it with this description');
      expect(prompt).toContain('Urban street setting');
    });

    it('should keep original background when backgroundPrompt is empty', () => {
      const stateNoBg = {
        ...defaultFormState,
        backgroundPrompt: '',
      };
      const prompt = buildVirtualTryOnPrompt(stateNoBg);
      expect(prompt).toContain('Keep the original background from the Subject Image exactly as is');
    });

    it('should keep original background when backgroundPrompt is whitespace only', () => {
      const stateWhitespaceBg = {
        ...defaultFormState,
        backgroundPrompt: '   ',
      };
      const prompt = buildVirtualTryOnPrompt(stateWhitespaceBg);
      expect(prompt).toContain('Keep the original background from the Subject Image exactly as is');
    });

    it('should trim whitespace from backgroundPrompt', () => {
      const stateWithWhitespace = {
        ...defaultFormState,
        backgroundPrompt: '   Park setting   ',
      };
      const prompt = buildVirtualTryOnPrompt(stateWithWhitespace);
      expect(prompt).toContain('Park setting');
      expect(prompt).not.toContain('   Park setting   ');
    });
  });

  describe('prompt content - core messaging', () => {
    it('should contain instruction header', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('# INSTRUCTION: VIRTUAL FASHION TRY-ON');
    });

    it('should preserve Subject/Clothing distinction in IMAGE ROLES', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('Subject Image');
      expect(prompt).toContain('Clothing Source Image');
    });

    it('should contain face/body preservation requirement', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('preserve the person\'s facial features');
      expect(prompt).toContain('hairstyle');
      expect(prompt).toContain('body shape');
      expect(prompt).toContain('skin tone');
    });

    it('should contain outfit replacement core task', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('Replace the outfit on the person');
      expect(prompt).toContain('single source of truth');
    });

    it('should contain pose generation instructions', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('new dynamic fashion pose');
      expect(prompt).toContain('confident, chic, and magazine-cover ready');
    });

    it('should contain removal instruction', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('Completely remove the original outfit');
    });

    it('should contain occlusion preservation instruction', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('Preserve occlusions');
      expect(prompt).toContain('hands, hair strands, accessories');
    });

    it('should contain photorealistic quality requirement', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).toContain('photorealistic');
      expect(prompt).toContain('2K');
    });
  });

  describe('determinism', () => {
    it('should produce identical output for identical inputs', () => {
      const state = {
        ...defaultFormState,
        extraPrompt: 'Test extra',
        backgroundPrompt: 'Test background',
      };

      const prompt1 = buildVirtualTryOnPrompt(state);
      const prompt2 = buildVirtualTryOnPrompt(state);

      expect(prompt1).toBe(prompt2);
    });

    it('should not contain the input fields in output', () => {
      const state: VirtualTryOnFormState = {
        subjectImageCount: 1,
        clothingImageCount: 2,
        extraPrompt: 'Extra test string',
        backgroundPrompt: 'Background test',
        numImages: 1,
      };

      const prompt = buildVirtualTryOnPrompt(state);

      // numImages should not appear as a raw number in the prompt
      expect(prompt).not.toContain('numImages');
      // These are internal form state fields, not part of the output
      expect(prompt).not.toContain('subjectImageCount');
      expect(prompt).not.toContain('clothingImageCount');
    });
  });

  describe('dual-garment waist-layering rules', () => {
    it('dual-garment (clothingImageCount=2) binds Image 2 as top, Image 3 as bottom', () => {
      const prompt = buildVirtualTryOnPrompt(dualGarmentFormState);
      expect(prompt).toContain('Image 2 (Top Garment Image)');
      expect(prompt).toContain('Image 3 (Bottom Garment Image)');
    });

    it('dual-garment adds waistband-overlap language', () => {
      const prompt = buildVirtualTryOnPrompt(dualGarmentFormState);
      expect(prompt).toMatch(/drapes over|overlaps the waistband/);
    });

    it('dual-garment preserves source hem length', () => {
      const prompt = buildVirtualTryOnPrompt(dualGarmentFormState);
      expect(prompt).toContain('Preserve the source hem length of the top exactly');
    });

    it('single-garment (clothingImageCount=1) does not add dual-garment role binding', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).not.toContain('Image 2 (Top Garment Image)');
    });

    it('single-garment does not claim bottom garment exists', () => {
      const prompt = buildVirtualTryOnPrompt(defaultFormState);
      expect(prompt).not.toContain('Image 3 (Bottom Garment Image)');
    });

    it('extraPrompt cannot override mandatory untucked rule', () => {
      const stateWithTuckInstruction = {
        ...dualGarmentFormState,
        extraPrompt: 'tuck the shirt into the pants',
      };
      const prompt = buildVirtualTryOnPrompt(stateWithTuckInstruction);
      expect(prompt).toContain('MUST always be worn UNTUCKED');
      expect(prompt).toContain('tuck the shirt into the pants');
    });
  });
});
