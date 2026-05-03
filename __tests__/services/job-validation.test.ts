import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { submitJob } from '../../server/adapters/base-adapter';
import { mapInput as mapPhotoAlbumInput } from '../../server/adapters/photo-album';
import type { DB } from '../../server/db';
import { validateJobPayload, type PhotoAlbumPayload } from '../../server/validation';

describe('job payload validation', () => {
  it('rejects empty image strings in list payloads', () => {
    expect(() => validateJobPayload('lookbook', { images: [''] })).toThrow();
    expect(() => validateJobPayload('photo-album', { images: [''] })).toThrow();
  });

  it('keeps photo album generation fields for backend execution', () => {
    const payload = validateJobPayload('photo-album', {
      images: ['image-a'],
      prompt: 'make a contact sheet',
      aspectRatio: '16:9',
      resolution: '2K',
    }) as PhotoAlbumPayload;

    expect(payload).toEqual({
      images: ['image-a'],
      prompt: 'make a contact sheet',
      aspectRatio: '16:9',
      resolution: '2K',
    });
    expect(mapPhotoAlbumInput(payload)).toEqual({
      images: ['image-a'],
      format: undefined,
      prompt: 'make a contact sheet',
      aspectRatio: '16:9',
      resolution: '2K',
    });
  });

  it('rejects prototype-chain feature names as unknown features', () => {
    expect(() => validateJobPayload('__proto__', {})).toThrow('Unknown feature: __proto__');
  });

  it('uses validated payload for job idempotency and persistence', async () => {
    const validatedPayload = { images: ['image-a'], style: 'editorial' };
    const expectedKey = createHash('sha256')
      .update(`user-1:lookbook:${JSON.stringify(validatedPayload)}`)
      .digest('hex');

    const query = vi.fn()
      .mockImplementationOnce((_sql: string, params?: unknown[]) => Promise.resolve({
        rows: [{
          id: params?.[0],
          user_id: 'user-1',
          feature: 'lookbook',
          status: 'queued',
          idempotency_key: params?.[3],
          input_payload_json: JSON.parse(params?.[4] as string),
          workflow_run_id: null,
          progress_total: 0,
          progress_done: 0,
          created_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
          error_code: null,
          error_message: null,
        }],
      }))
      .mockResolvedValueOnce({ rows: [{ id: 'event-1' }] });
    const db: DB = { query, withTransaction: vi.fn() };

    const job = await submitJob(db, 'user-1', 'lookbook', {
      ...validatedPayload,
      ignored: 'strip-me',
    });

    expect(query.mock.calls[0][1]?.[3]).toBe(expectedKey);
    expect(query.mock.calls[0][1]?.[4]).toBe(JSON.stringify(validatedPayload));
    expect(job.input_payload_json).toEqual(validatedPayload);
  });
});

describe('photo album backend execution', () => {
  it('uses the submitted photo album prompt instead of the default prompt', async () => {
    vi.resetModules();

    const generateImagesFromBatch = vi.fn().mockResolvedValue([{ base64: 'result', mimeType: 'image/png' }]);
    vi.doMock('../../server/gemini', () => ({
      editImage: vi.fn(),
      generateImagesFromBatch,
    }));

    const { geminiExecuteStep } = await import('../../server/workflows/gemini-executor');

    await geminiExecuteStep({} as never, {
      images: ['image-a'],
      prompt: 'make a contact sheet',
    }, 'photo-album');

    expect(generateImagesFromBatch).toHaveBeenCalledWith(['image-a'], 'make a contact sheet');
  });
});
