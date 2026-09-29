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
  /**
   * The operator's own outfit note for this job ("pants, not a skirt"). It
   * reaches generation independently of the AI Scan blueprint, so the note
   * still holds when the scan is off or fails closed. Each prompt family
   * phrases it in its own wording (ADR-0002).
   */
  userGuidance?: string;
}
