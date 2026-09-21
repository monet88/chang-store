import { describe, it, expect } from 'vitest';
import {
  CAMERA_FRAMING_INSTRUCTION,
  CAMERA_FRAMING_PROHIBITION_LINES,
} from '@/utils/cameraFramingPolicy';
import { buildGeminiVirtualTryOnParts } from '@/utils/gemini-virtual-try-on-prompt';
import { buildGptVirtualTryOnParts } from '@/utils/gpt-virtual-try-on-prompt';
import type { VirtualTryOnPromptInput } from '@/utils/virtual-try-on-prompt-types';
import type { ImageFile } from '@/types';

const mockImage: ImageFile = {
  base64: 'mock-base64',
  mimeType: 'image/png',
};

const vtoInput: VirtualTryOnPromptInput = {
  subjectImage: mockImage,
  sourceItems: [{ image: mockImage, sourceItemType: 'clothing' }],
  extraPrompt: '',
  backgroundPrompt: '',
};

describe('cameraFramingPolicy', () => {
  it('defines camera distance and field of view preservation rules', () => {
    expect(CAMERA_FRAMING_INSTRUCTION).toContain('Preserve exact camera distance');
    expect(CAMERA_FRAMING_INSTRUCTION).toContain('field of view');
    expect(CAMERA_FRAMING_INSTRUCTION).toContain('subject-to-frame scale ratio');
    expect(CAMERA_FRAMING_INSTRUCTION).toContain('do not zoom in');
  });

  it('defines negative camera zoom prohibitions', () => {
    expect(CAMERA_FRAMING_PROHIBITION_LINES[0]).toContain('Never zoom in');
    expect(CAMERA_FRAMING_PROHIBITION_LINES[1]).toContain('Do not alter the camera distance');
  });

  it('hard-codes camera framing instructions in Gemini Virtual Try-On prompt', () => {
    const parts = buildGeminiVirtualTryOnParts(vtoInput);
    const text = parts.map((p) => p.text || '').join('\n');

    expect(text).toContain(CAMERA_FRAMING_INSTRUCTION);
    CAMERA_FRAMING_PROHIBITION_LINES.forEach((line) => {
      expect(text).toContain(line);
    });
  });

  it('hard-codes camera framing instructions in GPT Virtual Try-On prompt', () => {
    const parts = buildGptVirtualTryOnParts(vtoInput);
    const text = parts[0]?.text || '';

    expect(text).toContain(CAMERA_FRAMING_INSTRUCTION);
    CAMERA_FRAMING_PROHIBITION_LINES.forEach((line) => {
      expect(text).toContain(line);
    });
  });
});
