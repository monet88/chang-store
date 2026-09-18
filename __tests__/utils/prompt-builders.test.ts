import { describe, expect, it } from 'vitest';
import {
  buildTextPosePrompt,
  buildReferencePosePrompt,
} from '../../src/utils/pose-changer-prompt-builder';
import { buildBackgroundReplacementPrompt } from '../../src/utils/background-replacer-prompt-builder';
import {
  buildSingleImageEditPrompt,
  buildMultiImageEditPrompt,
} from '../../src/utils/ai-editor-prompt-builder';
import { buildPhotoAlbumPrompt } from '../../src/utils/photo-album-prompt-builder';

describe('pose-changer prompt builder', () => {
  it('embeds the pose description and framing in the text prompt', () => {
    const out = buildTextPosePrompt('sitting on a stool', 'Full body shot.');
    expect(out).toContain('**New Pose Description**: "sitting on a stool".');
    expect(out).toContain('**Camera Framing**: Full body shot.');
    expect(out.startsWith('**Task**')).toBe(true);
  });

  it('appends the custom instruction only when provided', () => {
    const withCustom = buildReferencePosePrompt('smile softly', 'Half body.');
    expect(withCustom).toContain('**Additional Text Instruction**');
    expect(withCustom).toContain('smile softly');

    const withoutCustom = buildReferencePosePrompt('   ', 'Half body.');
    expect(withoutCustom).not.toContain('**Additional Text Instruction**');
  });
});

describe('background-replacer prompt builder', () => {
  it('uses the provided background image branch', () => {
    const out = buildBackgroundReplacementPrompt({
      framingInstruction: 'Eye level.',
      hasBackgroundImage: true,
      promptText: '',
    });
    expect(out).toContain('Replace with the provided Background Source image.');
    expect(out).not.toContain('Also apply:');
  });

  it('adds a modification note when text accompanies the background image', () => {
    const out = buildBackgroundReplacementPrompt({
      framingInstruction: 'Eye level.',
      hasBackgroundImage: true,
      promptText: 'warmer light',
    });
    expect(out).toContain('**Modification**: Also apply: "warmer light".');
  });

  it('treats a whitespace-only note as absent (background image branch)', () => {
    const out = buildBackgroundReplacementPrompt({
      framingInstruction: 'Eye level.',
      hasBackgroundImage: true,
      promptText: '   ',
    });
    expect(out).toContain('Replace with the provided Background Source image.');
    expect(out).not.toContain('Also apply:');
  });

  it('generates a background from text when no image is present', () => {
    const out = buildBackgroundReplacementPrompt({
      framingInstruction: 'Eye level.',
      hasBackgroundImage: false,
      promptText: 'a sunny beach',
    });
    expect(out).toContain('Generate a new photorealistic background: "a sunny beach".');
  });
});

describe('ai-editor prompt builders', () => {
  it('wraps a single-image edit request', () => {
    const out = buildSingleImageEditPrompt('make it brighter');
    expect(out).toContain('# INSTRUCTION: IMAGE EDITING');
    expect(out).toContain('make it brighter');
    expect(out).toContain('## EDIT RULES:');
  });

  it('includes image roles for a multi-image edit', () => {
    const out = buildMultiImageEditPrompt('blend them', '- Image 1 is @img2');
    expect(out).toContain('# INSTRUCTION: MULTI-IMAGE EDITING');
    expect(out).toContain('- Image 1 is @img2');
    expect(out).toContain('## EDIT RULES:');
    expect(out).toContain('blend them');
  });
});

describe('photo-album prompt builder', () => {
  it('composes every resolved section', () => {
    const out = buildPhotoAlbumPrompt({
      imageRolesPrompt: '**Image Role**: source',
      framingInstruction: 'Full body.',
      poseInstruction: 'standing straight',
      hairStyle: 'long straight',
      skinTone: 'fair',
      footwearInstruction: 'keep original shoes',
      backgroundInstruction: 'neutral studio',
      frameInstruction: 'Do not add any frame or border.',
      additionalNotesInstruction: '- No additional notes.',
    });
    expect(out).toContain('# INSTRUCTION: CREATE PHOTO ALBUM IMAGE');
    expect(out).toContain('The model\'s new pose MUST be: "standing straight".');
    expect(out).toContain('**Hair Style**: long straight');
    expect(out).toContain('**Skin Tone**: fair');
    expect(out).toContain('neutral studio');
  });
});

describe('resolution belongs to the API parameter, not the prompt', () => {
  // `editImage` passes `resolution` as `imageConfig.imageSize` (services/gemini/image.ts),
  // so a prompt that also asks for "2K" contradicts a 1K or 4K request.
  it('leaves the resolution out of the pose, background, and photo-album prompts', () => {
    const photoAlbum = buildPhotoAlbumPrompt({
      imageRolesPrompt: '**Image Role**: source',
      framingInstruction: 'Full body.',
      poseInstruction: 'standing straight',
      hairStyle: 'long straight',
      skinTone: 'fair',
      footwearInstruction: 'keep original shoes',
      backgroundInstruction: 'neutral studio',
      frameInstruction: 'Do not add any frame or border.',
      additionalNotesInstruction: '- No additional notes.',
    });
    const prompts = [
      buildTextPosePrompt('sitting on a stool', 'Full body shot.'),
      buildReferencePosePrompt('', 'Full body shot.'),
      buildBackgroundReplacementPrompt({
        framingInstruction: 'Eye level.',
        hasBackgroundImage: false,
        promptText: 'a sunny beach',
      }),
      photoAlbum,
    ];

    prompts.forEach((prompt) => expect(prompt).not.toMatch(/\(2K\)|\b2K\b/));
    // The resolution-free goal line still states the quality intent.
    expect(prompts[0]).toContain('**Final Goal**: A high-resolution, photorealistic image.');
    expect(photoAlbum).toContain('Generate a single, high-resolution, photorealistic fashion photograph');
  });
});
