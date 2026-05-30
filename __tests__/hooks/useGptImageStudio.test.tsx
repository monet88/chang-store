import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetProviderSettings = vi.fn();
const mockResetProviderSettings = vi.fn();

vi.mock('@/contexts/ApiProviderContext', () => ({
    useApi: () => ({
        providerSettings: {
            grok: { apiKey: '', baseUrl: 'https://api.x.ai/v1' },
            gptImage: { apiKey: 'oai-key', baseUrl: 'https://api.openai.com/v1' },
        },
        setProviderSettings: mockSetProviderSettings,
        resetProviderSettings: mockResetProviderSettings,
    }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/services/providers/gpt-image/gptImageService', () => ({
    generateGptImage: vi.fn(),
    editGptImage: vi.fn(),
}));

import { useGptImageStudio } from '@/hooks/useGptImageStudio';
import { generateGptImage, editGptImage } from '@/services/providers/gpt-image/gptImageService';
import { Feature, ImageFile } from '@/types';

const RESULT: ImageFile = { base64: 'OUT', mimeType: 'image/png' };
const SOURCE: ImageFile = { base64: 'SRC', mimeType: 'image/jpeg' };

describe('useGptImageStudio', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(generateGptImage).mockResolvedValue([RESULT]);
        vi.mocked(editGptImage).mockResolvedValue([RESULT]);
    });

    it('reads provider settings from context', () => {
        const { result } = renderHook(() => useGptImageStudio(Feature.AIEditor, 'gptImage'));
        expect(result.current.apiKey).toBe('oai-key');
        expect(result.current.baseUrl).toBe('https://api.openai.com/v1');
        expect(result.current.maxReferenceImages).toBe(10);
    });

    it('routes prompt-only requests to generate', async () => {
        const { result } = renderHook(() => useGptImageStudio(Feature.PatternGenerator, 'gptImage'));

        act(() => {
            result.current.setPrompt('seamless pattern');
        });

        await act(async () => {
            await result.current.handleGenerate();
        });

        expect(generateGptImage).toHaveBeenCalledTimes(1);
        expect(editGptImage).not.toHaveBeenCalled();
        expect(result.current.results).toEqual([RESULT]);
    });

    it('routes image requests to multipart edit', async () => {
        const { result } = renderHook(() => useGptImageStudio(Feature.AIEditor, 'gptImage'));

        act(() => {
            result.current.setPrompt('change the background');
            result.current.setImages([SOURCE]);
        });

        await act(async () => {
            await result.current.handleGenerate();
        });

        expect(editGptImage).toHaveBeenCalledTimes(1);
        expect(generateGptImage).not.toHaveBeenCalled();
    });

    it('surfaces service errors', async () => {
        vi.mocked(generateGptImage).mockRejectedValue(new Error('error.provider.requestFailed'));
        const { result } = renderHook(() => useGptImageStudio(Feature.PatternGenerator, 'gptImage'));

        act(() => {
            result.current.setPrompt('x');
        });

        await act(async () => {
            await result.current.handleGenerate();
        });

        expect(result.current.error).toBe('error.provider.requestFailed');
    });

    it('stays silent when aborted', async () => {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        vi.mocked(generateGptImage).mockRejectedValue(abortError);

        const { result } = renderHook(() => useGptImageStudio(Feature.PatternGenerator, 'gptImage'));
        act(() => {
            result.current.setPrompt('x');
        });
        await act(async () => {
            await result.current.handleGenerate();
        });

        expect(result.current.error).toBeNull();
    });

    it('resets workflow state on feature change', async () => {
        const { result, rerender } = renderHook(
            ({ feature }) => useGptImageStudio(feature, 'gptImage'),
            { initialProps: { feature: Feature.AIEditor } },
        );

        act(() => {
            result.current.setPrompt('keep me?');
            result.current.setImages([SOURCE]);
        });

        rerender({ feature: Feature.TryOn });

        await waitFor(() => {
            expect(result.current.prompt).toBe('');
            expect(result.current.images).toEqual([]);
        });
    });

    it('persists settings changes through context', () => {
        const { result } = renderHook(() => useGptImageStudio(Feature.AIEditor, 'gptImage'));

        act(() => {
            result.current.setApiKey('new-oai-key');
            result.current.resetSettings();
        });

        expect(mockSetProviderSettings).toHaveBeenCalledWith('gptImage', { apiKey: 'new-oai-key' });
        expect(mockResetProviderSettings).toHaveBeenCalledWith('gptImage');
    });
});
