import { beforeEach, describe, expect, it } from 'vitest';
import {
  CUSTOM_DISPLAY_TEMPLATES_STORAGE_KEY,
  DEFAULT_DISPLAY_TEMPLATES,
  deleteCustomDisplayTemplate,
  loadCustomDisplayTemplates,
  saveCustomDisplayTemplate,
} from '../../src/config/displayTemplates';

describe('displayTemplates', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('ships text presets for both hanger and flat-lay staging', () => {
    expect(DEFAULT_DISPLAY_TEMPLATES.some((template) => template.category === 'hanger' && template.modality === 'text')).toBe(true);
    expect(DEFAULT_DISPLAY_TEMPLATES.some((template) => template.category === 'flat-lay' && template.modality === 'text')).toBe(true);
  });

  it('persists user-defined image and text templates', () => {
    saveCustomDisplayTemplate({
      id: 'custom-text',
      name: 'Linen',
      category: 'flat-lay',
      modality: 'text',
      prompt: 'Soft ivory linen surface',
    });
    saveCustomDisplayTemplate({
      id: 'custom-image',
      name: 'Shop hanger',
      category: 'hanger',
      modality: 'image',
      prompt: 'Match the reference',
      image: { base64: 'hanger-ref', mimeType: 'image/png' },
    });

    expect(loadCustomDisplayTemplates()).toHaveLength(2);
    expect(window.localStorage.getItem(CUSTOM_DISPLAY_TEMPLATES_STORAGE_KEY)).toContain('custom-image');

    deleteCustomDisplayTemplate('custom-text');
    expect(loadCustomDisplayTemplates().map((template) => template.id)).toEqual(['custom-image']);
  });
});
