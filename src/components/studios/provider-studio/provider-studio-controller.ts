import { ImageFile } from '../../../types';
import { UseProviderStudioFieldsReturn } from '../../../hooks/useProviderStudioFields';
import { UseProviderResultActionsReturn } from '../../../hooks/useProviderResultActions';
import { UseProviderTryOnBatchReturn } from '../../../hooks/useProviderTryOnBatch';
import { UseProviderLookbookFieldsReturn } from '../../../hooks/useProviderLookbookFields';
import { UseProviderWardrobeReturn } from '../../../hooks/useProviderWardrobe';
import { UseProviderLookbookOutputReturn } from '../../../hooks/useProviderLookbookOutput';
import { VirtualTryOnMode } from '../../../types';

/**
 * Shared control surface provider studio hooks (`useGptImageStudio`)
 * satisfy. `ProviderStudioShell` is typed against this so
 * it renders the provider without knowing the provider-specific options
 * (quality/size for GPT), which are passed
 * in as `optionsSlot`. Derived from the existing sub-hook return intersections
 * so it stays in sync with no field re-declaration.
 */
export interface ProviderStudioController
  extends UseProviderStudioFieldsReturn,
    UseProviderResultActionsReturn,
    UseProviderTryOnBatchReturn,
    UseProviderLookbookFieldsReturn {
  apiKey: string;
  baseUrl: string;
  setApiKey: (value: string) => void;
  setBaseUrl: (value: string) => void;
  resetSettings: () => void;
  /** True when no offered model is one the active profile serves — Generate stays disabled. */
  noSelectableModel: boolean;
  prompt: string;
  setPrompt: (value: string) => void;
  images: ImageFile[];
  setImages: (images: ImageFile[]) => void;
  isLoading: boolean;
  error: string | null;
  results: ImageFile[];
  clearError: () => void;
  handleGenerate: () => Promise<void>;
  maxReferenceImages: number;
  tryOnMode: VirtualTryOnMode;
  setTryOnMode: (mode: VirtualTryOnMode) => void;
  wardrobe: UseProviderWardrobeReturn;
  lookbookOutput: UseProviderLookbookOutputReturn;
}
