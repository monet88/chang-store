import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetProviderSettings = vi.fn();
const mockResetProviderSettings = vi.fn();

const PROFILE = {
    id: 'xompet',
    label: 'xompet',
    baseUrl: 'https://api.xompet.io.vn',
    apiKey: 'xompet-key',
    lane: 'image' as const,
    driver: 'openai-images' as const,
    enabled: true,
};
const mockImageProfiles: Array<typeof PROFILE> = [];

vi.mock('@/contexts/ApiProviderContext', () => ({
    useApi: () => ({
        providerSettings: {
            grok: { apiKey: '', baseUrl: 'https://api.x.ai/v1' },
            gptImage: { apiKey: 'oai-key', baseUrl: 'https://api.openai.com/v1' },
        },
        setProviderSettings: mockSetProviderSettings,
        resetProviderSettings: mockResetProviderSettings,
        imageProfiles: mockImageProfiles,
        activeImageProfileId: PROFILE.id,
        servedModelsVersion: 0,
        saveGatewayProfiles: vi.fn(),
        selectImageProfile: vi.fn(),
        imageProfileForDriver: () => undefined,
        notifyServedModelsChanged: vi.fn(),
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
        localStorage.clear();
        mockImageProfiles.length = 0;
        vi.mocked(generateGptImage).mockResolvedValue([RESULT]);
        vi.mocked(editGptImage).mockResolvedValue([RESULT]);
    });

    it('offers the models the active profile serves, and their sizes', () => {
        localStorage.setItem('gateway_models_cache_v1', JSON.stringify([{
            baseUrl: 'https://api.xompet.io.vn',
            fetchedAt: Date.now(),
            modelIds: ['gpt-image-2.5-sunburst'],
            ownedBy: {},
        }]));
        mockImageProfiles.push(PROFILE);

        const { result } = renderHook(() => useGptImageStudio(Feature.PatternGenerator, 'gptImage'));

        const selectable = result.current.modelOptions.filter((option) => !option.disabled);
        expect(selectable.map((option) => option.modelId)).toEqual(['gpt-image-2.5-sunburst']);
        expect(result.current.modelOptions).toContainEqual(
            expect.objectContaining({ modelId: 'gpt-image-2', disabled: true }),
        );
        expect(result.current.model).toBe('gpt-image-2.5-sunburst');
        expect(result.current.sizeOptions).toEqual(['auto', '1080x1920', '1536x1024', '1024x1024', '1024x1536']);
        expect(result.current.supportsSize).toBe(true);
        expect(result.current.supportsQuality).toBe(false);
    });

    it('reads provider settings from context', () => {
        const { result } = renderHook(() => useGptImageStudio(Feature.AIEditor, 'gptImage'));
        expect(result.current.apiKey).toBe('oai-key');
        expect(result.current.baseUrl).toBe('https://api.openai.com/v1');
        expect(result.current.maxReferenceImages).toBe(10);
    });

    it('falls back to the pinned model and its documented sizes without a profile', () => {
        const { result } = renderHook(() => useGptImageStudio(Feature.PatternGenerator, 'gptImage'));

        expect(result.current.model).toBe('gpt-image-2');
        expect(result.current.sizeOptions).toEqual(['auto', '1024x1024', '1536x1024', '1024x1536']);
        expect(result.current.supportsQuality).toBe(true);
    });

    it('hides the size control on a gateway that answers its own size', () => {
        mockImageProfiles.push({ ...PROFILE, id: 'cpa-image', baseUrl: 'https://cliproxy.monet.uno' });
        localStorage.setItem('gateway_models_cache_v1', JSON.stringify([{
            baseUrl: 'https://cliproxy.monet.uno',
            fetchedAt: Date.now(),
            modelIds: ['gpt-image-2'],
            ownedBy: {},
        }]));

        const { result } = renderHook(() => useGptImageStudio(Feature.PatternGenerator, 'gptImage'));

        expect(result.current.model).toBe('gpt-image-2');
        expect(result.current.supportsSize).toBe(false);
        expect(result.current.supportsQuality).toBe(false);
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
