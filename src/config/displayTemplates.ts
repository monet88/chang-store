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
    id: 'hanger-wood',
    name: 'Móc Gỗ Tối Giản',
    category: 'hanger',
    modality: 'text',
    prompt:
      'A minimalist commercial studio photograph of the clothing item hanging gracefully on a sleek natural light-wood hanger against a clean, solid off-white studio wall. The garment drapes naturally under gravity with authentic fabric folds. Eye-level centered product shot with soft directional side lighting and realistic contact shadows.',
  },
  {
    id: 'hanger-metal',
    name: 'Móc Kim Loại Đen',
    category: 'hanger',
    modality: 'text',
    prompt:
      'A modern boutique fashion photo of the garment displayed on a minimalist brushed matte-black metal clothes hanger against a neutral warm-grey studio wall. Diffused studio spotlight creating soft fabric highlights, realistic natural hanging silhouette and no background clutter.',
  },
  {
    id: 'flatlay-linen',
    name: 'Trải Sàn Vải Lanh',
    category: 'flat-lay',
    modality: 'text',
    prompt:
      'A professional e-commerce flat lay photograph of the clothing item, laid out neatly on a clean neutral textured linen fabric surface. Natural soft diffused daylight casting realistic gentle contact folds and subtle fabric drape shadows. Centered commercial catalog top-down view.',
  },
  {
    id: 'flatlay-marble',
    name: 'Trải Bàn Đá Marble',
    category: 'flat-lay',
    modality: 'text',
    prompt:
      'A luxury fashion flat lay photograph of the garment arranged neatly on a polished white marble tabletop with subtle grey veining. Soft, elegant studio key lighting, highlighting fabric texture, stitching details, and clean garment contours.',
  },
];
