import { describe, expect, it } from 'vitest';
import {
  buildTextPosePrompt,
  buildReferencePosePrompt,
} from '../../src/utils/pose-changer-prompt-builder';

const BLUEPRINT = 'WEAVE & MATERIAL: plissé accordion pleats in silk georgette, matte finish.';
const HEADING = 'AI SCAN — TEXTILE & GARMENT DECONSTRUCTION';

describe('pose-changer prompt builders — AI Scan blueprint', () => {
  it('splices the blueprint into the text pose prompt', () => {
    const out = buildTextPosePrompt('sitting on a stool', 'Full body shot.', BLUEPRINT);

    expect(out).toContain(HEADING);
    expect(out).toContain(BLUEPRINT);
  });

  it('splices the blueprint into the reference pose prompt', () => {
    const out = buildReferencePosePrompt('smile softly', 'Half body.', BLUEPRINT);

    expect(out).toContain(HEADING);
    expect(out).toContain(BLUEPRINT);
  });

  it('leaves both prompts byte-identical when the blueprint is omitted or blank', () => {
    expect(buildTextPosePrompt('sitting', 'Full body shot.', '')).toBe(
      buildTextPosePrompt('sitting', 'Full body shot.'),
    );
    expect(buildTextPosePrompt('sitting', 'Full body shot.', '   ')).toBe(
      buildTextPosePrompt('sitting', 'Full body shot.'),
    );
    expect(buildReferencePosePrompt('smile', 'Half body.', '')).toBe(
      buildReferencePosePrompt('smile', 'Half body.'),
    );
    expect(buildReferencePosePrompt('smile', 'Half body.', '   ')).toBe(
      buildReferencePosePrompt('smile', 'Half body.'),
    );

    expect(buildTextPosePrompt('sitting', 'Full body shot.')).not.toContain('AI SCAN');
    expect(buildReferencePosePrompt('smile', 'Half body.')).not.toContain('AI SCAN');
  });
});
