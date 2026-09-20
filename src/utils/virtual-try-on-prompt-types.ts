import type { ImageFile, VirtualTryOnSourceItemType } from '../types';

export interface VirtualTryOnPromptSourceItem {
  image: ImageFile;
  sourceItemType: VirtualTryOnSourceItemType;
  sourcePrompt?: string;
}

export interface VirtualTryOnPromptInput {
  subjectImage: ImageFile;
  sourceItems: VirtualTryOnPromptSourceItem[];
  extraPrompt: string;
  backgroundPrompt: string;
  isMultiPersonMode?: boolean;
  /** AI Scan textile deconstruction of the source items (issue #162). */
  outfitBlueprint?: string;
}
