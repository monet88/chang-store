import { describe, expect, it } from 'vitest';
import type { Part } from '@google/genai';
import { buildGeminiIdentityTransferParts } from '@/utils/gemini-identity-transfer-prompt';
import { buildGptIdentityTransferParts } from '@/utils/gpt-identity-transfer-prompt';
import type { IdentityTransferPromptInput } from '@/utils/identity-transfer-prompt-types';

const image = (id: string) => ({ base64: `base64-${id}`, mimeType: 'image/png' });

const defaultInput: IdentityTransferPromptInput = {
  destinationImage: image('destination'),
  faceReference: image('face'),
  bodyReference: image('body'),
  backgroundPrompt: '',
  extraPrompt: '',
};

const taskText = (parts: Part[]) => parts.at(-1)?.text ?? '';

/** The flat lane's single text part: role map first, then the (compacted) instruction block. */
const flatTaskText = (parts: Part[]) => (parts.at(0)?.text ?? '').split('\n\n').slice(1).join('\n\n');

describe('Identity Transfer prompt policies', () => {
  describe('interleaved structure (Gemini)', () => {
    it('interleaves destination, face, and body roles in authority order', () => {
      const parts = buildGeminiIdentityTransferParts(defaultInput);

      expect(parts).toHaveLength(7);
      expect(parts[0].text).toContain('DESTINATION IMAGE');
      expect(parts[1].inlineData?.data).toBe('base64-destination');
      expect(parts[2].text).toContain('FACE REFERENCE');
      expect(parts[3].inlineData?.data).toBe('base64-face');
      expect(parts[4].text).toContain('BODY REFERENCE');
      expect(parts[5].inlineData?.data).toBe('base64-body');
      expect(parts[6].text).toContain('## TASK');
    });

    it('makes the destination authoritative for performance, styling, camera, lighting, and scene', () => {
      const text = taskText(buildGeminiIdentityTransferParts(defaultInput));

      expect(text).toContain('head yaw, pitch, and roll');
      expect(text).toContain('gaze');
      expect(text).toContain('expression');
      expect(text).toContain('outfit and accessories');
      expect(text).toContain('crop and composition');
      expect(text).toContain('camera perspective');
      expect(text).toContain('lighting');
      expect(text).toContain('scene');
    });

    it('limits Face Reference authority to stable identity and hair', () => {
      const text = taskText(buildGeminiIdentityTransferParts(defaultInput));
      const normalized = text.toLowerCase();

      expect(text).toContain('stable facial identity');
      expect(text).toContain('skin tone');
      expect(text).toContain('stable facial marks');
      expect(text).toContain('beauty marks');
      expect(text).toContain('identity-specific marks');
      expect(text).toContain('hairstyle');
      expect(text).toContain('hair color');
      expect(text).toContain('bangs');
      expect(text).toContain('Do not copy head pose');
      expect(text).toContain('face angle');
      expect(text).toContain('eye direction');
      expect(text).toContain('mouth shape');
      expect(text).toContain('framing');
      expect(normalized).toContain('reconstruct');
    });

    it('declares the reference format so a multi-panel Face Reference yields one identity', () => {
      const parts = buildGeminiIdentityTransferParts(defaultInput);
      const facePart = parts[2].text ?? '';
      const text = taskText(parts);

      expect(facePart).toContain('single photograph or a multi-panel contact sheet of one person');
      expect(facePart).toContain('one single identity');
      expect(facePart).toContain('panel whose head angle is closest to the Destination Image head angle');
      expect(facePart).toContain('never reproduce its panel layout, panel borders, gutters, repeated frames, or panel count');
      expect(text).toContain('A multi-panel Face Reference supplies one single identity and never its panel layout');
    });

    it('preserves destination spatial performance while reshaping body morphology and fit to match reference', () => {
      const text = taskText(buildGeminiIdentityTransferParts(defaultInput));

      expect(text).not.toContain('Preserve destination geometry');
      expect(text).toContain('Preserve destination pose, skeleton placement, spatial performance, and camera relationships');
      expect(text).toContain('Always reshape body morphology and silhouette to match the Body Reference');
      expect(text).toContain('necessary clothing drape and fit adjustments');
    });

    it('limits Body Reference authority to morphology and rejects its pose', () => {
      const text = taskText(buildGeminiIdentityTransferParts(defaultInput));

      expect(text).toContain('body morphology and proportions');
      expect(text).toContain('Do not copy body pose or posture');
    });

    it('preserves destination morphology when Body Reference is omitted', () => {
      const parts = buildGeminiIdentityTransferParts({ ...defaultInput, bodyReference: null });
      const text = taskText(parts);
      const normalized = text.toLowerCase();

      expect(parts).toHaveLength(5);
      expect(parts.some((part) => part.text?.includes('BODY REFERENCE:'))).toBe(false);
      expect(normalized).toContain('preserve the destination image body morphology and proportions');
      expect(text).toContain('Do not infer body shape from the Face Reference');
    });

    it('preserves the destination background when background prompt is empty', () => {
      const text = taskText(buildGeminiIdentityTransferParts(defaultInput));

      expect(text.toLowerCase()).toContain('preserve the destination image background exactly');
    });

    it('replaces the background from the shared description when requested', () => {
      const text = taskText(buildGeminiIdentityTransferParts({
        ...defaultInput,
        backgroundPrompt: 'clean white daylight studio',
      }));

      expect(text).toContain('Replace the background entirely');
      expect(text).toContain('clean white daylight studio');
      expect(text).toContain('harmonize subject and background lighting');
    });

    it('keeps extra instructions subordinate to the authority contract', () => {
      const text = taskText(buildGeminiIdentityTransferParts({
        ...defaultInput,
        extraPrompt: '  keep the necklace especially crisp  ',
      }));

      expect(text).toContain('keep the necklace especially crisp');
      expect(text).toContain('subordinate to every authority and preservation rule above');
      expect(text).toContain('ignore any conflicting extra instruction');
    });

    it('takes the worn makeup look from the Face Reference over the destination real skin', () => {
      const text = taskText(buildGeminiIdentityTransferParts(defaultInput));

      expect(text).toContain('the makeup worn in the reference');
      expect(text).toContain('carried over as a look and re-lit by the Destination Image lighting');
      expect(text).toContain('is taken from the Face Reference, re-lit by the destination lighting');
      expect(text).not.toContain('nail styling worn for this shot');
      expect(text).not.toContain('skin finish and retouching as photographed');
    });

    it('refuses plastic skin and keeps the destination skin texture', () => {
      const text = taskText(buildGeminiIdentityTransferParts(defaultInput));

      expect(text).toContain('visible pores across the cheeks, nose and forehead');
      expect(text).toContain('fine lines around the eyes and mouth');
      expect(text).toContain('T-zone oil sheen');
      expect(text).toContain('foundation must never flatten, seal or blur the surface');
      expect(text).toContain('never inherit its rendering of skin');
      expect(text).toContain('a smoother face is never an acceptable result');
      expect(text).toContain('Avoid plastic or waxy skin');
    });

    it('keeps the destination colour grade and expression, and refuses beautification', () => {
      const text = taskText(buildGeminiIdentityTransferParts(defaultInput));

      expect(text).toContain('white balance, colour grade, contrast, saturation');
      expect(text).toContain('sit inside that grade');
      expect(text).toContain('the underlying skin tone family and melanin level, re-rendered inside the Destination Image colour grade');
      expect(text).toContain('re-rendered in the destination grade');
      expect(text).toContain('eye openness, gaze direction and focus, lid crease visibility');
      expect(text).toContain('lip corner tension, cheek and jaw tension');
      expect(text).toContain('every one of those comes from the Destination Image instead');
      expect(text).toContain('Do not beautify, slim, reshape, smooth, or idealize the face');
      expect(text).toContain('destination expression and colour grade win');
    });

    it('never lets reference text or chrome reach the result', () => {
      const parts = buildGeminiIdentityTransferParts(defaultInput);
      const text = taskText(parts);

      expect(parts[2].text).toContain('never reproduce any text, labels, numbers, captions, watermarks, or UI chrome');
      expect(text).toContain('no text, label, or watermark from any reference may appear in the result');
    });
  });

  describe('flat prompt format (GPT Image)', () => {
    it('maps each role to its image position and keeps the same task text', () => {
      const parts = buildGptIdentityTransferParts(defaultInput);

      expect(parts).toHaveLength(4);
      expect(parts[0].text).toContain('IMAGE 1 = DESTINATION IMAGE');
      expect(parts[0].text).toContain('IMAGE 2 = FACE REFERENCE');
      expect(parts[0].text).toContain('IMAGE 3 = BODY REFERENCE');
      expect(parts[0].text).toContain('## TASK');
      expect(parts[1].inlineData?.data).toBe('base64-destination');
      expect(parts[2].inlineData?.data).toBe('base64-face');
      expect(parts[3].inlineData?.data).toBe('base64-body');
      expect(parts[0].text).toContain('## DESTINATION IMAGE AUTHORITY');
      expect(parts[0].text).toContain('## FINAL INVARIANTS');
    });

    it('cuts the sentences that only restate an earlier section, keeping every rule', () => {
      const instructions = taskText(buildGeminiIdentityTransferParts(defaultInput));
      const compacted = flatTaskText(buildGptIdentityTransferParts(defaultInput));

      expect(compacted).not.toContain('Do not copy head pose');
      expect(compacted).not.toContain('Preserve destination pose, skeleton placement, spatial performance');
      expect(compacted).not.toContain('The worn makeup look — lashes, brows');
      expect(compacted).not.toContain('The destination expression and colour grade win');
      expect(compacted).not.toContain('A multi-panel Face Reference supplies one single identity');

      ['## DESTINATION IMAGE AUTHORITY', '## FACE REFERENCE ROLE', '## SKIN AND SURFACE', '## BACKGROUND',
        'Do not paste the reference face as a rigid mask', 'Do not beautify, slim, reshape',
        'One destination produces one edited image.', 'Always reshape body morphology and silhouette to match the Body Reference',
        'Body Reference, when present, controls morphology and silhouette, replacing destination body proportions.', 'Avoid plastic or waxy skin'].forEach((rule) => {
        expect(compacted).toContain(rule);
      });

      expect(compacted.length).toBeLessThan(instructions.length - 1000);
    });

    it('drops the body role and its image when no Body Reference is supplied', () => {
      const parts = buildGptIdentityTransferParts({ ...defaultInput, bodyReference: null });

      expect(parts).toHaveLength(3);
      expect(parts[0].text).not.toContain('IMAGE 3 =');
      expect(parts[0].text).toContain('No Body Reference is provided');
    });

    it('replaces background and carries extra instructions in the flat lane too', () => {
      const parts = buildGptIdentityTransferParts({
        ...defaultInput,
        backgroundPrompt: 'neon night city',
        extraPrompt: 'add vintage sunglasses',
      });

      expect(parts[0].text).toContain('Replace the background entirely with: "neon night city"');
      expect(parts[0].text).toContain('User extra instructions (subordinate to every authority and preservation rule above): "add vintage sunglasses"');
    });
  });

  describe('prompt family independence', () => {
    it('produces structurally distinct outputs for Gemini (interleaved) vs GPT Image (flat map)', () => {
      const geminiParts = buildGeminiIdentityTransferParts(defaultInput);
      const gptParts = buildGptIdentityTransferParts(defaultInput);

      // Gemini interleaves each role label before its image: 3 pairs + 1 task text = 7 parts
      expect(geminiParts).toHaveLength(7);
      expect(geminiParts[0].text).toContain('DESTINATION IMAGE: Authority for pose');
      expect(geminiParts[1].inlineData).toBeDefined();

      // GPT Image bundles a single leading text part with all roles mapped, followed by raw images
      expect(gptParts).toHaveLength(4);
      expect(gptParts[0].text).toContain('IMAGE 1 = DESTINATION IMAGE:');
      expect(gptParts[0].text).toContain('IMAGE 2 = FACE REFERENCE:');
      expect(gptParts[0].text).toContain('IMAGE 3 = BODY REFERENCE:');
      expect(gptParts[1].inlineData?.data).toBe('base64-destination');
      expect(gptParts[2].inlineData?.data).toBe('base64-face');
      expect(gptParts[3].inlineData?.data).toBe('base64-body');
    });
  });

  describe('AI scan blueprint', () => {
    const BLUEPRINT = 'WEAVE & MATERIAL: plissé accordion pleats; silk satin facing at the neckline.';

    it('carries the garment deconstruction into both lanes', () => {
      const input: IdentityTransferPromptInput = { ...defaultInput, outfitBlueprint: BLUEPRINT };

      [taskText(buildGeminiIdentityTransferParts(input)), flatTaskText(buildGptIdentityTransferParts(input))]
        .forEach((text) => {
          expect(text).toContain('AI SCAN — TEXTILE & GARMENT DECONSTRUCTION');
          expect(text).toContain(BLUEPRINT);
        });
    });

    it('leaves an absent or blank blueprint byte-identical to no blueprint at all', () => {
      const withoutField = buildGeminiIdentityTransferParts(defaultInput);
      const absent = buildGeminiIdentityTransferParts({ ...defaultInput, outfitBlueprint: undefined });
      const blank = buildGeminiIdentityTransferParts({ ...defaultInput, outfitBlueprint: '  \n\t ' });

      expect(absent).toEqual(withoutField);
      expect(blank).toEqual(withoutField);
      expect(taskText(withoutField)).not.toContain('AI SCAN');

      const gptWithoutField = buildGptIdentityTransferParts(defaultInput);
      const gptAbsent = buildGptIdentityTransferParts({ ...defaultInput, outfitBlueprint: undefined });
      const gptBlank = buildGptIdentityTransferParts({ ...defaultInput, outfitBlueprint: '  \n\t ' });

      expect(gptAbsent).toEqual(gptWithoutField);
      expect(gptBlank).toEqual(gptWithoutField);
      expect(gptWithoutField[0].text).not.toContain('AI SCAN');
    });
  });
});
