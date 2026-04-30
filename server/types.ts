// Server-side Feature enum values — mirrors src/types.ts Feature enum
export const Feature = {
  TryOn: 'try-on',
  Lookbook: 'lookbook',
  Background: 'background',
  Pose: 'pose',
  PhotoAlbum: 'photo-album',
  AIEditor: 'ai-editor',
  WatermarkRemover: 'watermark-remover',
  ClothingTransfer: 'clothing-transfer',
  PatternGenerator: 'pattern-generator',
} as const;

// eslint-disable-next-line no-redeclare
export type Feature = (typeof Feature)[keyof typeof Feature];
