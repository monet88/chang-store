import { describe, expect, it } from 'vitest';
import type { Part } from '@google/genai';
import {
  buildIdentityTransferParts,
  type IdentityTransferPromptInput,
} from '@/utils/identity-transfer-prompt-builder';

const image = (id: string) => ({ base64: `base64-${id}`, mimeType: 'image/png' });

const defaultInput: IdentityTransferPromptInput = {
  destinationImage: image('destination'),
  faceReference: image('face'),
  bodyReference: image('body'),
  backgroundPrompt: '',
  extraPrompt: '',
};

const taskText = (parts: Part[]) => parts.at(-1)?.text ?? '';

describe('buildIdentityTransferParts', () => {
  it('interleaves destination, face, and body roles in authority order', () => {
    const parts = buildIdentityTransferParts(defaultInput);

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
    const text = taskText(buildIdentityTransferParts(defaultInput));

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
    const text = taskText(buildIdentityTransferParts(defaultInput));
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
    const parts = buildIdentityTransferParts(defaultInput);
    const facePart = parts[2].text ?? '';
    const text = taskText(parts);

    expect(facePart).toContain('single photograph or a multi-panel contact sheet of one person');
    expect(facePart).toContain('one single identity');
    expect(facePart).toContain('panel whose head angle is closest to the Destination Image head angle');
    expect(facePart).toContain('never reproduce its panel layout, panel borders, gutters, repeated frames, or panel count');
    expect(text).toContain('A multi-panel Face Reference supplies one single identity and never its panel layout');
  });

  it('preserves destination spatial performance while allowing body morphology and fit to change', () => {
    const text = taskText(buildIdentityTransferParts(defaultInput));

    expect(text).not.toContain('Preserve destination geometry');
    expect(text).toContain('Preserve destination pose, skeleton placement, spatial performance, and camera relationships');
    expect(text).toContain('Allow body morphology and silhouette to change');
    expect(text).toContain('necessary clothing drape and fit adjustments');
  });

  it('limits Body Reference authority to morphology and rejects its pose', () => {
    const text = taskText(buildIdentityTransferParts(defaultInput));

    expect(text).toContain('body morphology and proportions');
    expect(text).toContain('Do not copy body pose or posture');
  });

  it('preserves destination morphology when Body Reference is omitted', () => {
    const parts = buildIdentityTransferParts({ ...defaultInput, bodyReference: null });
    const text = taskText(parts);
    const normalized = text.toLowerCase();

    expect(parts).toHaveLength(5);
    expect(parts.some((part) => part.text?.includes('BODY REFERENCE:'))).toBe(false);
    expect(normalized).toContain('preserve the destination image body morphology and proportions');
    expect(text).toContain('Do not infer body shape from the Face Reference');
  });

  it('preserves the destination background when background prompt is empty', () => {
    const text = taskText(buildIdentityTransferParts(defaultInput));

    expect(text.toLowerCase()).toContain('preserve the destination image background exactly');
  });

  it('replaces the background from the shared description when requested', () => {
    const text = taskText(buildIdentityTransferParts({
      ...defaultInput,
      backgroundPrompt: 'clean white daylight studio',
    }));

    expect(text).toContain('Replace the background entirely');
    expect(text).toContain('clean white daylight studio');
    expect(text).toContain('harmonize subject and background lighting');
  });

  it('keeps extra instructions subordinate to the authority contract', () => {
    const text = taskText(buildIdentityTransferParts({
      ...defaultInput,
      extraPrompt: '  keep the necklace especially crisp  ',
    }));

    expect(text).toContain('keep the necklace especially crisp');
    expect(text).toContain('subordinate to every authority and preservation rule above');
    expect(text).toContain('ignore any conflicting extra instruction');
  });
});
