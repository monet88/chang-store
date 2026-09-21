import type { ImageFile } from '../types';

export type DisplayTemplateCategory = 'hanger' | 'flat-lay';
export type DisplayTemplateModality = 'image' | 'text';

export interface DisplayTemplate {
  id: string;
  name: string;
  category: DisplayTemplateCategory;
  modality: DisplayTemplateModality;
  prompt: string;
  image?: ImageFile | null;
}

export const DEFAULT_DISPLAY_TEMPLATES: DisplayTemplate[] = [
  {
    id: 'preset-hanger-clean',
    name: 'Clean Studio Hanger',
    category: 'hanger',
    modality: 'text',
    prompt: 'Hang the garment naturally on a clean neutral hanger against a bright minimal studio wall with soft diffused commercial lighting.',
  },
  {
    id: 'preset-hanger-boutique',
    name: 'Boutique Hanger',
    category: 'hanger',
    modality: 'text',
    prompt: 'Hang the garment naturally on a premium wooden hanger in a minimal boutique setting with warm soft light and uncluttered background.',
  },
  {
    id: 'preset-flat-lay-linen',
    name: 'Ivory Linen Flat Lay',
    category: 'flat-lay',
    modality: 'text',
    prompt: 'Arrange the garment as a clean editorial flat lay on soft ivory linen with natural folds, soft contact shadows, and balanced negative space.',
  },
  {
    id: 'preset-flat-lay-marble',
    name: 'Marble Flat Lay',
    category: 'flat-lay',
    modality: 'text',
    prompt: 'Arrange the garment as a premium flat lay on a clean light marble surface with soft daylight, realistic contact shadows, and no unrelated props.',
  },
];

export const CUSTOM_DISPLAY_TEMPLATES_STORAGE_KEY = 'chang_store_custom_display_templates';

export const loadCustomDisplayTemplates = (): DisplayTemplate[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_DISPLAY_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DisplayTemplate => Boolean(
      item
      && typeof item === 'object'
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && (item.category === 'hanger' || item.category === 'flat-lay')
      && (item.modality === 'image' || item.modality === 'text')
      && typeof item.prompt === 'string',
    ));
  } catch {
    return [];
  }
};

export const saveCustomDisplayTemplate = (template: DisplayTemplate): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const existing = loadCustomDisplayTemplates().filter((item) => item.id !== template.id);
  try {
    window.localStorage.setItem(
      CUSTOM_DISPLAY_TEMPLATES_STORAGE_KEY,
      JSON.stringify([...existing, template]),
    );
  } catch (err) {
    console.warn('Unable to persist custom display template to localStorage:', err);
  }
};

export const deleteCustomDisplayTemplate = (id: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const next = loadCustomDisplayTemplates().filter((item) => item.id !== id);
    window.localStorage.setItem(CUSTOM_DISPLAY_TEMPLATES_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Unable to remove custom display template from localStorage:', err);
  }
};
