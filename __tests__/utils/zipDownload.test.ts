import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  zipFileMock,
  generateAsyncMock,
  zipInstances,
  downloadBlobMock,
  imageFileToJpegBlobMock,
} = vi.hoisted(() => ({
  zipFileMock: vi.fn(),
  generateAsyncMock: vi.fn(),
  zipInstances: [] as Array<{ file: ReturnType<typeof vi.fn>; generateAsync: ReturnType<typeof vi.fn> }>,
  downloadBlobMock: vi.fn(),
  imageFileToJpegBlobMock: vi.fn(async (image: { base64: string }) => (
    new Blob([image.base64], { type: 'image/jpeg' })
  )),
}));

vi.mock('jszip', () => ({
  default: class MockZip {
    file = zipFileMock;
    generateAsync = generateAsyncMock;

    constructor() {
      zipInstances.push({ file: this.file, generateAsync: this.generateAsync });
    }
  },
}));

vi.mock('@/utils/imageDownload', async () => {
  const actual = await vi.importActual<typeof import('@/utils/imageDownload')>('@/utils/imageDownload');

  return {
    ...actual,
    downloadBlob: downloadBlobMock,
    imageFileToJpegBlob: imageFileToJpegBlobMock,
  };
});

import { downloadImagesAsZip } from '@/utils/zipDownload';

describe('downloadImagesAsZip', () => {
  beforeEach(() => {
    zipInstances.length = 0;
    zipFileMock.mockReset();
    generateAsyncMock.mockReset();
    downloadBlobMock.mockReset();
    imageFileToJpegBlobMock.mockClear();
    generateAsyncMock.mockResolvedValue(new Blob(['zip-bytes'], { type: 'application/zip' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names zip entries with the feature prefix and jpg extension', async () => {
    await downloadImagesAsZip(
      [
        { base64: 'one', mimeType: 'image/png' },
        { base64: 'two', mimeType: 'image/webp' },
      ],
      'clothing-transfer-batch',
    );

    expect(zipInstances).toHaveLength(1);
    expect(zipFileMock).toHaveBeenNthCalledWith(
      1,
      'clothing-transfer-001.jpg',
      expect.anything(),
    );
    expect(zipFileMock).toHaveBeenNthCalledWith(
      2,
      'clothing-transfer-002.jpg',
      expect.anything(),
    );
    expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), 'clothing-transfer-batch.zip');
  });
});
