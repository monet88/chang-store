/**
 * Realistic Fashion Studio Test Fixtures
 *
 * Provides realistic domain assets, garment references, display templates,
 * and semantic prompts for the 10 fashion studio features.
 */

import type { ImageFile } from '@/types';
import type { ReferenceRoleImage } from './testHarness';

export const FIXTURE_IMAGES = {
  modelSubjectA: {
    base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
  } as ImageFile,
  modelSubjectB: {
    base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
  } as ImageFile,
  brandModelFemale: {
    base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwGAq/v3AgAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
  } as ImageFile,
  silkBlouseTop: {
    base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    mimeType: 'image/jpeg',
  } as ImageFile,
  tailoredTrousersBottom: {
    base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    mimeType: 'image/jpeg',
  } as ImageFile,
  pleatedMidiSkirt: {
    base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    mimeType: 'image/jpeg',
  } as ImageFile,
  woolBlazerOuterwear: {
    base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    mimeType: 'image/jpeg',
  } as ImageFile,
  fabricSwatchTextile: {
    base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJAgP+iO6l3AAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
  } as ImageFile,
  flatLayTemplate: {
    base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWMrwHwADywGg59y0qAAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
  } as ImageFile,
  hangerTemplate: {
    base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk2MfwHwAD/gGdD1/h5wAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
  } as ImageFile,
  watermarkedImage: {
    base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mOUYPj/HwAC7QGfn7f/pAAAAABJRU5ErkJggg==',
    mimeType: 'image/png',
  } as ImageFile,
};

export const FIXTURE_REFERENCES: Record<string, ReferenceRoleImage[]> = {
  tryOnTwoPiece: [
    {
      image: FIXTURE_IMAGES.modelSubjectA,
      role: 'subject',
      label: 'SUBJECT: Model portrait full body',
    },
    {
      image: FIXTURE_IMAGES.silkBlouseTop,
      role: 'garment',
      label: 'SOURCE ITEM #1 (clothing): Cream silk blouse',
    },
    {
      image: FIXTURE_IMAGES.tailoredTrousersBottom,
      role: 'garment',
      label: 'SOURCE ITEM #2 (clothing): Navy bifurcated tailored trousers',
    },
  ],
  clothingTransferECom: [
    {
      image: FIXTURE_IMAGES.modelSubjectA,
      role: 'subject',
      label: 'SOURCE MODEL: Wearing target clothing',
    },
    {
      image: FIXTURE_IMAGES.woolBlazerOuterwear,
      role: 'garment',
      label: 'GARMENT: Charcoal tailored wool blazer',
    },
    {
      image: FIXTURE_IMAGES.brandModelFemale,
      role: 'subject',
      label: 'DESTINATION MODEL: Official Brand Model',
    },
  ],
  identityTransfer: [
    {
      image: FIXTURE_IMAGES.modelSubjectB,
      role: 'subject',
      label: 'TARGET SCENE: Editorial street shoot',
    },
    {
      image: FIXTURE_IMAGES.brandModelFemale,
      role: 'style',
      label: 'IDENTITY SOURCE: Facial structure and identity',
    },
  ],
};

export const FIXTURE_PROMPTS = {
  tryOn: 'Virtual try-on: Dress the model in the cream silk blouse and navy tailored trousers. Maintain realistic fabric drape.',
  tryOnUntuckedForced: 'Virtual try-on: Dress model in cream blouse and trousers. Tops remain untucked outside waistband.',
  tryOnTuckAllowed: 'Virtual try-on: Dress model in blouse and trousers. allow tucking for sleek business fit.',
  lookbookCatalog: 'Lookbook catalog shoot: Clean studio lighting, 3:4 portrait view, editorial high-fashion presentation.',
  backgroundReplace: 'Background replacement: Place fashion model in a sunlit Parisian café terrace overlooking Haussmann architecture.',
  poseChange: 'Pose modification: Model standing with hands resting lightly in front, body angled slightly toward camera.',
  photoAlbum: 'Thematic photo album: Summer resort fashion collection, coastal aesthetic, warm natural afternoon light.',
  aiEditor: 'AI retouch: Soften the fabric shadows across the chest and slightly adjust collar sharpness.',
  watermarkRemove: 'Watermark removal: Inpaint transparent watermark overlay from upper corner with clean fabric texture.',
  clothingTransfer: 'Clothing transfer: Transfer the charcoal wool blazer from the source mannequin onto destination brand model.',
  identityTransfer: 'QWEN IDENTITY TRANSFER SPECIFICATION: Preserve subject facial features and likeness seamlessly into scene.',
  identityTransferRefusal: 'Identity transfer: Adapt clothing and pose, but keep the original face without face swap.',
  patternGenerator: 'Seamless textile pattern: Repeatable geometric herringbone pattern, rich olive and beige threads, macro fabric weave.',
};
