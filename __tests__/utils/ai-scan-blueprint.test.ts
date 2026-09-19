import { describe, expect, it } from 'vitest';
import { AI_SCAN_BLOCK_HEADER, formatAiScanBlock } from '../../src/utils/ai-scan-blueprint';

describe('ai-scan-blueprint', () => {
  it('returns an empty string when there is no blueprint', () => {
    expect(formatAiScanBlock(undefined)).toBe('');
    expect(formatAiScanBlock(null)).toBe('');
    expect(formatAiScanBlock('')).toBe('');
    expect(formatAiScanBlock('   \n  ')).toBe('');
  });

  it('splices the blueprint under the AI Scan heading', () => {
    const block = formatAiScanBlock('WEAVE & MATERIAL: plissé accordion pleats, silk satin.');

    expect(block).toContain(AI_SCAN_BLOCK_HEADER);
    expect(block).toContain('WEAVE & MATERIAL: plissé accordion pleats, silk satin.');
  });

  it('trims the blueprint and keeps it on its own block', () => {
    const block = formatAiScanBlock('  DRAPE PHYSICS: fluid fall.  \n');

    expect(block.startsWith('\n\n')).toBe(true);
    expect(block).toContain(`${AI_SCAN_BLOCK_HEADER}:\nDRAPE PHYSICS: fluid fall.\n`);
    // A leading blank line separates the block from the task text it follows.
    expect(block.endsWith('\n')).toBe(true);
  });
});
