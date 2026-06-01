import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateGptImage, editGptImage, imageFileToBlob } from '@/services/providers/gpt-image/gptImageService';
import { ProviderApiError } from '@/services/providers/shared/ProviderApiError';
import { ImageFile } from '@/types';

const CONFIG = { apiKey: 'oai-test-key', baseUrl: 'https://api.openai.com/v1' };

// btoa-safe base64 of a few bytes.
const makeImage = (mimeType = 'image/jpeg'): ImageFile => ({ base64: btoa('hello'), mimeType });

const okResponse = (body: unknown): Response =>
    ({ ok: true, status: 200, json: async () => body }) as Response;

const errorResponse = (status: number, body: unknown): Response =>
    ({ ok: false, status, json: async () => body }) as Response;

describe('gptImageService', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('imageFileToBlob', () => {
        it('preserves the MIME type', () => {
            const blob = imageFileToBlob(makeImage('image/webp'));
            expect(blob.type).toBe('image/webp');
        });
    });

    describe('generateGptImage', () => {
        it('posts JSON to /images/generations with size and quality', async () => {
            fetchMock.mockResolvedValue(okResponse({ data: [{ b64_json: 'IMG' }] }));

            const result = await generateGptImage(
                { model: 'gpt-image-2', prompt: 'a studio shot', size: '1024x1024', quality: 'high' },
                CONFIG,
            );

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe('https://api.openai.com/v1/images/generations');
            expect(init.headers['Content-Type']).toBe('application/json');
            const body = JSON.parse(init.body);
            expect(body).toMatchObject({
                model: 'gpt-image-2',
                prompt: 'a studio shot',
                n: 1,
                size: '1024x1024',
                quality: 'high',
            });
            expect(result).toEqual([{ base64: 'IMG', mimeType: 'image/png' }]);
        });

        it('throws ProviderApiError on non-2xx', async () => {
            fetchMock.mockResolvedValue(errorResponse(400, { error: { message: 'bad', code: 'invalid' } }));
            await expect(
                generateGptImage(
                    { model: 'gpt-image-2', prompt: 'x', size: 'auto', quality: 'auto' },
                    CONFIG,
                ),
            ).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('editGptImage', () => {
        it('sends multipart form data with repeated image[] fields and no manual Content-Type', async () => {
            fetchMock.mockResolvedValue(okResponse({ data: [{ b64_json: 'EDIT' }] }));

            await editGptImage(
                {
                    model: 'gpt-image-2',
                    prompt: 'edit it',
                    images: [makeImage('image/jpeg'), makeImage('image/png')],
                    size: '1024x1024',
                    quality: 'medium',
                },
                CONFIG,
            );

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe('https://api.openai.com/v1/images/edits');
            expect(init.method).toBe('POST');
            // No manual Content-Type — only Authorization header set.
            expect(init.headers['Content-Type']).toBeUndefined();
            expect(init.headers.Authorization).toBe('Bearer oai-test-key');

            const form = init.body as FormData;
            expect(form).toBeInstanceOf(FormData);
            expect(form.get('model')).toBe('gpt-image-2');
            expect(form.get('prompt')).toBe('edit it');
            expect(form.get('size')).toBe('1024x1024');
            expect(form.get('quality')).toBe('medium');
            const imageEntries = form.getAll('image[]');
            expect(imageEntries).toHaveLength(2);
        });

        it('rejects more than the product cap of reference images before any network call', async () => {
            const tooMany = Array.from({ length: 11 }, () => makeImage());
            await expect(
                editGptImage(
                    { model: 'gpt-image-2', prompt: 'x', images: tooMany, size: 'auto', quality: 'auto' },
                    CONFIG,
                ),
            ).rejects.toMatchObject({ code: 'too_many_images' });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('retries on auth_unavailable then succeeds', async () => {
            fetchMock
                .mockResolvedValueOnce(errorResponse(503, { error: { message: 'auth_unavailable', code: 'auth_unavailable' } }))
                .mockResolvedValueOnce(okResponse({ data: [{ b64_json: 'EDIT' }] }));

            const result = await editGptImage(
                { model: 'gpt-image-2', prompt: 'edit', images: [makeImage()], size: 'auto', quality: 'auto' },
                CONFIG,
            );

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(result).toEqual([{ base64: 'EDIT', mimeType: 'image/png' }]);
        });

        it('requires an API key', async () => {
            await expect(
                editGptImage(
                    { model: 'gpt-image-2', prompt: 'x', images: [makeImage()], size: 'auto', quality: 'auto' },
                    { apiKey: '', baseUrl: CONFIG.baseUrl },
                ),
            ).rejects.toMatchObject({ status: 401 });
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });
});
