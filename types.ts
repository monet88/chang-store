export enum Feature {
  TryOn = 'try-on',
  Lookbook = 'lookbook',
  Background = 'background',
  Pose = 'pose',
  SwapFace = 'swap-face',
  PhotoAlbum = 'photo-album',
  OutfitAnalysis = 'outfit-analysis',
  Relight = 'relight',
  Upscale = 'upscale',
  ImageEditor = 'image-editor',
  Video = 'video',
  VideoContinuity = 'video-continuity',
  Inpainting = 'inpainting',
  GRWMVideo = 'grwm-video',
}

export interface ImageFile {
  base64: string;
  mimeType: string;
}

export type AspectRatio = 'Default' | '1:1' | '9:16' | '16:9' | '4:3' | '3:4';

export interface AnalyzedItem {
  item: string;
  description: string;
  possibleBrands: string[];
}

export type Quality = 'standard' | 'high';

export interface LookbookSet {
  id: string;
  createdAt: number;
  images: ImageFile[];
  spinImages?: ImageFile[];
}

export interface Pose {
    title: string;
    label: string;
    imageUrl: string;
}

export interface PoseCollection {
    title: string;
    poses: Pose[];
}

export interface AIVideoAutoModel {
  id_base: string;
  name: string;
  description?: string;
  server: string;
  model: string;
  price: number;
  startText: boolean;
  startImage: boolean;
  startImageAndEnd?: boolean;
  withReference?: boolean;
  extendVideo?: boolean;
  withLipsync?: boolean;
  withMotion?: boolean;
  ratios?: Array<{ name: string; type: string }>;
  resolutions?: Array<{ name: string; type: string }>;
  durations?: Array<{ name: string; type: string }>;
  prices?: Array<any>;
  mode?: Array<{ type: string; name: string; description: string; price: number }>;
  videoTotalToday?: number;
  videoMaxToday?: number;
  [key: string]: any; // Allow additional fields from API
}

export type ImageEditModel = string;
export type ImageGenerateModel = string;
export type VideoGenerateModel = string;
export type TextGenerateModel = string;