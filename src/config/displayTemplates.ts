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

export const DEFAULT_DISPLAY_TEMPLATES: DisplayTemplate[] = [];
