import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useProviderLookbookFields } from '@/hooks/useProviderLookbookFields';

describe('useProviderLookbookFields', () => {
    it('defaults to the flat-lay provider Lookbook state', () => {
        const { result } = renderHook(() => useProviderLookbookFields());
        expect(result.current.lookbookState.lookbookStyle).toBe('flat lay');
        expect(result.current.lookbookFabricImage).toBeNull();
    });

    it('merges partial field updates', () => {
        const { result } = renderHook(() => useProviderLookbookFields());

        act(() => {
            result.current.setLookbookField({ lookbookStyle: 'mannequin' });
            result.current.setLookbookField({ negativePrompt: 'no clutter' });
        });

        expect(result.current.lookbookState.lookbookStyle).toBe('mannequin');
        expect(result.current.lookbookState.negativePrompt).toBe('no clutter');
        // Earlier fields preserved across merges.
        expect(result.current.lookbookState.garmentType).toBe('one-piece');
    });

    it('tracks the fabric texture image', () => {
        const { result } = renderHook(() => useProviderLookbookFields());

        act(() => {
            result.current.setLookbookFabricImage({ base64: 'FAB', mimeType: 'image/png' });
        });
        expect(result.current.lookbookFabricImage).toEqual({ base64: 'FAB', mimeType: 'image/png' });
    });

    it('resets to defaults', () => {
        const { result } = renderHook(() => useProviderLookbookFields());

        act(() => {
            result.current.setLookbookField({ lookbookStyle: 'hanger' });
            result.current.setLookbookFabricImage({ base64: 'FAB', mimeType: 'image/png' });
        });

        act(() => {
            result.current.resetLookbookFields();
        });

        expect(result.current.lookbookState.lookbookStyle).toBe('flat lay');
        expect(result.current.lookbookFabricImage).toBeNull();
    });
});
