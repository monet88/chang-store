import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDownloadFilename,
  downloadImageAsJpeg,
  imageFileToJpegBlob,
} from '@/utils/imageDownload';

describe('buildDownloadFilename', () => {
  it('uses the feature prefix and random token for single-image downloads', () => {
    expect(buildDownloadFilename('clothing-transfer', { randomToken: 'abc123' })).toBe(
      'clothing-transfer-abc123.jpg',
    );
  });

  it('uses zero-padded indexes for batch image names', () => {
    expect(buildDownloadFilename('virtual-tryon', { index: 3 })).toBe(
      'virtual-tryon-003.jpg',
    );
  });
});

describe('image download helpers', () => {
  const OriginalImage = global.Image;
  const originalCreateElement = document.createElement.bind(document);
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  let anchorClick: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    anchorClick = vi.fn();
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
    removeChildSpy = vi.spyOn(document.body, 'removeChild');

    class MockImage {
      width = 640;
      height = 480;
      onload: (() => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      private _src = '';

      get src() {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    }

    global.Image = MockImage as unknown as typeof Image;

    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            fillStyle: '#fff',
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          })),
          toBlob: vi.fn((callback: BlobCallback) => {
            callback(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
          }),
        } as unknown as HTMLCanvasElement;
      }

      if (tagName === 'a') {
        const anchor = originalCreateElement('a');
        anchor.click = anchorClick;
        return anchor;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    URL.createObjectURL = vi.fn(() => 'blob:download-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.Image = OriginalImage;
    document.createElement = originalCreateElement;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('converts an ImageFile into a JPEG blob', async () => {
    const blob = await imageFileToJpegBlob({
      base64: 'raw-image-data',
      mimeType: 'image/png',
    });

    expect(blob.type).toBe('image/jpeg');
  });

  it('downloads a JPEG using the feature prefix in the filename', async () => {
    await downloadImageAsJpeg(
      { base64: 'raw-image-data', mimeType: 'image/webp' },
      { prefix: 'clothing-transfer', randomToken: 'fixedtoken' },
    );

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(appendChildSpy).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    const anchor = appendChildSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('clothing-transfer-fixedtoken.jpg');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download-url');
  });
});
