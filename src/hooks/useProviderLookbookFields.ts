import { useCallback, useState } from 'react';
import { ImageFile } from '../types';
import { LookbookFormState } from '../utils/lookbookPromptBuilder';
import { DEFAULT_PROVIDER_LOOKBOOK_STATE } from '../utils/provider-studio-prompt-adapter';

/**
 * Shared Lookbook control-surface state for provider studios (Phase 6).
 *
 * Holds the full `LookbookFormState` (style / garment / fabric / negative) so
 * provider Lookbook reaches parity with Gemini instead of a forced default.
 * The clothing reference images live in the studio's main `images` array; the
 * fabric texture image is tracked here as a separate optional input.
 */
export interface UseProviderLookbookFieldsReturn {
    lookbookState: LookbookFormState;
    setLookbookField: (updates: Partial<LookbookFormState>) => void;
    lookbookFabricImage: ImageFile | null;
    setLookbookFabricImage: (image: ImageFile | null) => void;
    resetLookbookFields: () => void;
}

const initialState = (): LookbookFormState => ({ ...DEFAULT_PROVIDER_LOOKBOOK_STATE });

export const useProviderLookbookFields = (): UseProviderLookbookFieldsReturn => {
    const [lookbookState, setLookbookState] = useState<LookbookFormState>(initialState);
    const [lookbookFabricImage, setLookbookFabricImage] = useState<ImageFile | null>(null);

    const setLookbookField = useCallback((updates: Partial<LookbookFormState>) => {
        setLookbookState((prev) => ({ ...prev, ...updates }));
    }, []);

    const resetLookbookFields = useCallback(() => {
        setLookbookState(initialState());
        setLookbookFabricImage(null);
    }, []);

    return {
        lookbookState,
        setLookbookField,
        lookbookFabricImage,
        setLookbookFabricImage,
        resetLookbookFields,
    };
};
