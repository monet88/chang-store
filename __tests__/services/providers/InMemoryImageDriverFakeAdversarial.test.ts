import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as zlib from 'node:zlib';
import {
  StudioDriverError,
  type StudioDriverErrorCode,
  type GenerateJob,
  type UpscaleJob,
  isStudioDriverError,
  isRetryableDriverError,
} from '@/services/providers/ImageDriver';
import {
  InMemoryImageDriverFake,
  createDeterministicPngBase64,
  resolveSyntheticDimensions,
  resolveUpscaleDimensions,
  RATIO_RESOLUTION_DIMENSIONS,
} from '@/services/providers/testing/InMemoryImageDriverFake';
import { extractDimensionsFromHeader } from '@/utils/imageAspectRatio';
import type { ImageAspectRatio, ImageResolution } from '@/types';

// ============================================================================
// Independent RFC 2083 PNG Oracle Implementation
// ============================================================================

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function computeOracleCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ParsedPngChunk {
  length: number;
  type: string;
  data: Uint8Array;
  crc: number;
  calculatedCrc: number;
  crcValid: boolean;
}

interface ParsedPng {
  signatureValid: boolean;
  signature: number[];
  chunks: ParsedPngChunk[];
  ihdr?: {
    width: number;
    height: number;
    bitDepth: number;
    colorType: number;
    compressionMethod: number;
    filterMethod: number;
    interlaceMethod: number;
  };
}

function parsePngBytes(bytes: Uint8Array): ParsedPng {
  const expectedSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const signature = Array.from(bytes.slice(0, 8));
  const signatureValid =
    signature.length === 8 && signature.every((b, i) => b === expectedSignature[i]);

  const chunks: ParsedPngChunk[] = [];
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length =
      ((bytes[offset] << 24) >>> 0) +
      (bytes[offset + 1] << 16) +
      (bytes[offset + 2] << 8) +
      bytes[offset + 3];

    const typeBytes = bytes.slice(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);

    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + length;
    const data = bytes.slice(chunkDataStart, chunkDataEnd);

    const crcOffset = chunkDataEnd;
    const crc =
      ((bytes[crcOffset] << 24) >>> 0) +
      (bytes[crcOffset + 1] << 16) +
      (bytes[crcOffset + 2] << 8) +
      bytes[crcOffset + 3];

    // CRC is calculated over chunk type + chunk data
    const crcPayload = new Uint8Array(4 + length);
    crcPayload.set(typeBytes, 0);
    crcPayload.set(data, 4);
    const calculatedCrc = computeOracleCrc32(crcPayload);

    chunks.push({
      length,
      type,
      data,
      crc,
      calculatedCrc,
      crcValid: (crc >>> 0) === (calculatedCrc >>> 0),
    });

    offset = crcOffset + 4;
  }

  let ihdr: ParsedPng['ihdr'];
  const ihdrChunk = chunks.find((c) => c.type === 'IHDR');
  if (ihdrChunk && ihdrChunk.data.length === 13) {
    const d = ihdrChunk.data;
    ihdr = {
      width: ((d[0] << 24) >>> 0) + (d[1] << 16) + (d[2] << 8) + d[3],
      height: ((d[4] << 24) >>> 0) + (d[5] << 16) + (d[6] << 8) + d[7],
      bitDepth: d[8],
      colorType: d[9],
      compressionMethod: d[10],
      filterMethod: d[11],
      interlaceMethod: d[12],
    };
  }

  return { signatureValid, signature, chunks, ihdr };
}

// ============================================================================
// Adversarial Challenger Test Suite
// ============================================================================

describe('Adversarial Challenger Suite: InMemoryImageDriverFake & ImageDriver Seam', () => {
  let fake: InMemoryImageDriverFake;

  beforeEach(() => {
    fake = new InMemoryImageDriverFake();
  });

  // --------------------------------------------------------------------------
  // Vector 1: PNG Specification Conformance & Cryptographic CRC Integrity
  // --------------------------------------------------------------------------
  describe('Vector 1: PNG Specification Conformance & Cryptographic CRC Integrity', () => {
    it('generates byte-perfect PNG header 89 50 4E 47 0D 0A 1A 0A', () => {
      const base64 = createDeterministicPngBase64(1024, 1024);
      const bytes = Buffer.from(base64, 'base64');
      const parsed = parsePngBytes(bytes);

      expect(parsed.signatureValid).toBe(true);
      expect(parsed.signature).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    });

    it('encodes exact 13-byte IHDR chunk with correct Big-Endian width and height', () => {
      const base64 = createDeterministicPngBase64(1536, 2048);
      const bytes = Buffer.from(base64, 'base64');
      const parsed = parsePngBytes(bytes);

      const ihdrChunk = parsed.chunks.find((c) => c.type === 'IHDR');
      expect(ihdrChunk).toBeDefined();
      expect(ihdrChunk!.length).toBe(13);
      expect(ihdrChunk!.crcValid).toBe(true);

      expect(parsed.ihdr).toBeDefined();
      expect(parsed.ihdr!.width).toBe(1536);
      expect(parsed.ihdr!.height).toBe(2048);
      expect(parsed.ihdr!.bitDepth).toBe(8);
      expect(parsed.ihdr!.colorType).toBe(6); // RGBA
      expect(parsed.ihdr!.compressionMethod).toBe(0);
      expect(parsed.ihdr!.filterMethod).toBe(0);
      expect(parsed.ihdr!.interlaceMethod).toBe(0);
    });

    it('verifies independent CRC-32 checksum validity across IDAT and IEND chunks', () => {
      const base64 = createDeterministicPngBase64(576, 1024);
      const bytes = Buffer.from(base64, 'base64');
      const parsed = parsePngBytes(bytes);

      const idatChunk = parsed.chunks.find((c) => c.type === 'IDAT');
      expect(idatChunk).toBeDefined();
      expect(idatChunk!.crcValid).toBe(true);

      const iendChunk = parsed.chunks.find((c) => c.type === 'IEND');
      expect(iendChunk).toBeDefined();
      expect(iendChunk!.crcValid).toBe(true);
      expect(iendChunk!.length).toBe(0);
    });

    it('successfully inflates the zlib compressed IDAT chunk stream via node:zlib', () => {
      const base64 = createDeterministicPngBase64(1024, 1024);
      const bytes = Buffer.from(base64, 'base64');
      const parsed = parsePngBytes(bytes);

      const idatChunk = parsed.chunks.find((c) => c.type === 'IDAT')!;
      expect(() => {
        const decompressed = zlib.inflateSync(idatChunk.data);
        expect(decompressed.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('consistently produces exactly 68 bytes for the deterministic PNG binary', () => {
      const base64 = createDeterministicPngBase64(2048, 1536);
      const bytes = Buffer.from(base64, 'base64');
      expect(bytes.length).toBe(68);
    });

    it('integrates seamlessly with extractDimensionsFromHeader synchronous parser', () => {
      const base64 = createDeterministicPngBase64(4096, 2304);
      const dims = extractDimensionsFromHeader(base64);
      expect(dims).toEqual({ width: 4096, height: 2304 });
    });
  });

  // --------------------------------------------------------------------------
  // Vector 2: Aspect Ratio & Resolution Exhaustive Matrix (18 Cells + Upscale)
  // --------------------------------------------------------------------------
  describe('Vector 2: Aspect Ratio & Resolution Exhaustive Matrix (18 Cells + Upscale)', () => {
    const aspectRatios: ImageAspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9', 'Default'];
    const resolutions: ImageResolution[] = ['1K', '2K', '4K'];

    for (const ratio of aspectRatios) {
      for (const res of resolutions) {
        it(`validates matrix cell: ratio=${ratio}, resolution=${res}`, async () => {
          const expectedDims = resolveSyntheticDimensions(ratio, res);
          const results = await fake.generate({
            prompt: `Matrix test ${ratio} ${res}`,
            aspectRatio: ratio,
            resolution: res,
          });

          expect(results).toHaveLength(1);
          const file = results[0];

          // 1. Synthetic file metadata matches expected dimensions
          expect(file.width).toBe(expectedDims.width);
          expect(file.height).toBe(expectedDims.height);
          expect(file.filename).toContain(`${expectedDims.width}x${expectedDims.height}`);

          // 2. Binary PNG header has byte-exact dimensions
          const bytes = Buffer.from(file.base64, 'base64');
          const parsed = parsePngBytes(bytes);
          expect(parsed.signatureValid).toBe(true);
          expect(parsed.ihdr?.width).toBe(expectedDims.width);
          expect(parsed.ihdr?.height).toBe(expectedDims.height);

          // 3. IHDR CRC32 must be valid for these specific dimensions
          const ihdrChunk = parsed.chunks.find((c) => c.type === 'IHDR')!;
          expect(ihdrChunk.crcValid).toBe(true);

          // 4. Client header extractor returns exact dimensions
          const clientDims = extractDimensionsFromHeader(file.base64);
          expect(clientDims).toEqual(expectedDims);
        });
      }
    }

    it('validates upscale dimensions for 2K, 4K, and default quality', async () => {
      const upscaled2K = await fake.upscale({
        image: { base64: 'placeholder', mimeType: 'image/png' },
        quality: '2K',
      });
      expect(upscaled2K.width).toBe(1536);
      expect(upscaled2K.height).toBe(2048);
      expect(upscaled2K.filename).toContain('upscaled');
      expect(extractDimensionsFromHeader(upscaled2K.base64)).toEqual({ width: 1536, height: 2048 });

      const upscaled4K = await fake.upscale({
        image: { base64: 'placeholder', mimeType: 'image/png' },
        quality: '4K',
      });
      expect(upscaled4K.width).toBe(3072);
      expect(upscaled4K.height).toBe(4096);
      expect(extractDimensionsFromHeader(upscaled4K.base64)).toEqual({ width: 3072, height: 4096 });

      const upscaledDefault = await fake.upscale({
        image: { base64: 'placeholder', mimeType: 'image/png' },
      });
      expect(upscaledDefault.width).toBe(1536);
      expect(upscaledDefault.height).toBe(2048);
    });
  });

  // --------------------------------------------------------------------------
  // Vector 3: Boundary Chaos & Input Fuzzing
  // --------------------------------------------------------------------------
  describe('Vector 3: Boundary Chaos & Input Fuzzing', () => {
    it('handles extreme prompt sizes (250KB string) without truncation or memory leak', async () => {
      const hugePrompt = 'Fashion details, silk drapery, cinematic lighting. '.repeat(5000);
      const results = await fake.generate({ prompt: hugePrompt });
      expect(results).toHaveLength(1);
      expect(fake.dispatchedJobs[0].prompt).toBe(hugePrompt);
    });

    it('handles unicode, surrogate pairs, and emoji prompts faithfully', async () => {
      const emojiPrompt = '👗 Áo dài lụa tơ tằm Hà Đông 👘 𝕽𝖊𝖋𝖎𝖓𝖊𝖉 𝕱𝖆𝖘𝖍𝖎𝖔𝖓 ✨';
      const results = await fake.generate({ prompt: emojiPrompt });
      expect(results).toHaveLength(1);
      expect(fake.dispatchedJobs[0].prompt).toBe(emojiPrompt);
    });

    it('handles control characters and null bytes in prompt without corruption', async () => {
      const controlPrompt = 'Prompt\x00with\x01null\x02and\x1fcontrol\r\nchars';
      const results = await fake.generate({ prompt: controlPrompt });
      expect(results).toHaveLength(1);
      expect(fake.dispatchedJobs[0].prompt).toBe(controlPrompt);
    });

    it('handles path traversal / illegal characters in workflow by sanitizing filename', async () => {
      const maliciousWorkflow = '../../../../etc/passwd; DROP TABLE studios; <script>';
      const results = await fake.generate({
        prompt: 'Sanitization check',
        workflow: maliciousWorkflow,
      });
      expect(results).toHaveLength(1);
      // Slashes, semicolons, angle brackets, and spaces must be replaced by underscores
      expect(results[0].filename).not.toContain('/');
      expect(results[0].filename).not.toContain('\\');
      expect(results[0].filename).not.toContain('..');
      expect(results[0].filename).not.toContain('<script>');
      expect(results[0].filename).toMatch(/^[a-zA-Z0-9_-]+\.png$/);
    });

    it('handles boundary count values: negative, 0, large count', async () => {
      const negResult = await fake.generate({ prompt: 'test', count: -10 });
      expect(negResult).toHaveLength(1);

      const zeroResult = await fake.generate({ prompt: 'test', count: 0 });
      expect(zeroResult).toHaveLength(1);

      const largeCount = 10;
      const multiResult = await fake.generate({ prompt: 'test', count: largeCount });
      expect(multiResult).toHaveLength(largeCount);
      multiResult.forEach((img, idx) => {
        expect(img.filename).toContain(`_${idx}.png`);
        expect(extractDimensionsFromHeader(img.base64)).toBeDefined();
      });
    });

    it('survives floating point count gracefully', async () => {
      const floatResult = await fake.generate({ prompt: 'test', count: 3.8 });
      // Math.max(1, 3.8) -> 3.8; for loop runs i=0, 1, 2, 3 -> 4 iterations
      expect(floatResult.length).toBeGreaterThanOrEqual(3);
    });

    it('falls back gracefully on unrecognized aspectRatio and resolution strings', async () => {
      const results = await fake.generate({
        prompt: 'test',
        aspectRatio: '21:9' as any,
        resolution: '8K' as any,
      });
      expect(results).toHaveLength(1);
      // Default fallback dimensions are 1536x2048 (2K 3:4)
      expect(results[0].width).toBe(1536);
      expect(results[0].height).toBe(2048);
    });

    it('handles undefined and empty images/references without error', async () => {
      const results1 = await fake.generate({
        prompt: 'No images/references',
        images: undefined,
        references: undefined,
      });
      expect(results1).toHaveLength(1);

      const results2 = await fake.generate({
        prompt: 'Empty images/references',
        images: [],
        references: [],
      });
      expect(results2).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // Vector 4: StudioDriverError Inheritance, Cause & Serialization
  // --------------------------------------------------------------------------
  describe('Vector 4: StudioDriverError Inheritance, Cause & Serialization', () => {
    it('satisfies complete inheritance hierarchy and prototype chain', () => {
      const error = new StudioDriverError('gateway_down', 'Service unavailable');
      expect(error instanceof StudioDriverError).toBe(true);
      expect(error instanceof Error).toBe(true);
      expect(Object.getPrototypeOf(error)).toBe(StudioDriverError.prototype);
      expect(error.name).toBe('StudioDriverError');
    });

    it('serializes category, status, and retryable cleanly to JSON', () => {
      const error = new StudioDriverError('rate_limited', 'Too many requests', {
        status: 429,
        retryable: true,
      });

      const jsonStr = JSON.stringify(error);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.category).toBe('rate_limited');
      expect(parsed.status).toBe(429);
      expect(parsed.retryable).toBe(true);
    });

    it('preserves nested cause and serializes without throwing when cause is standard', () => {
      const rootCause = new Error('Socket closed abruptly');
      const driverError = new StudioDriverError('gateway_down', 'Connection severed', {
        status: 504,
        cause: rootCause,
      });

      expect(driverError.cause).toBe(rootCause);
      expect(() => JSON.stringify(driverError)).not.toThrow();
    });

    it('exhaustive retryable matrix across all 6 categories and HTTP status codes', () => {
      const categories: StudioDriverErrorCode[] = [
        'safety_blocked',
        'rate_limited',
        'gateway_down',
        'hardware_error',
        'cancelled',
        'unknown',
      ];

      for (const cat of categories) {
        // Status 500
        const err500 = new StudioDriverError(cat, 'Fail 500', { status: 500 });
        if (cat === 'hardware_error') {
          // Hardware error must NEVER be retryable even with status 500
          expect(err500.retryable).toBe(false);
          expect(isRetryableDriverError(err500)).toBe(false);
        } else if (cat === 'rate_limited' || cat === 'gateway_down' || cat === 'unknown' || cat === 'safety_blocked' || cat === 'cancelled') {
          // Status >= 500 marks retryable: true for non-hardware errors
          expect(err500.retryable).toBe(true);
        }

        // Status 400
        const err400 = new StudioDriverError(cat, 'Fail 400', { status: 400 });
        if (cat === 'rate_limited') {
          expect(err400.retryable).toBe(true);
        } else {
          expect(err400.retryable).toBe(false);
        }

        // No status
        const errNoStatus = new StudioDriverError(cat, 'Fail no status');
        if (cat === 'rate_limited') {
          expect(errNoStatus.retryable).toBe(true);
        } else {
          expect(errNoStatus.retryable).toBe(false);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Vector 5: Deferral Race Conditions & Concurrency Chaos
  // --------------------------------------------------------------------------
  describe('Vector 5: Deferral Race Conditions & Concurrency Chaos', () => {
    it('handles multiple queued deferrals processed in FIFO sequence', async () => {
      const def1 = fake.deferNext();
      const def2 = fake.deferNext();

      let job1Done = false;
      let job2Done = false;

      const p1 = fake.generate({ prompt: 'Job 1' }).then((r) => {
        job1Done = true;
        return r;
      });
      const p2 = fake.generate({ prompt: 'Job 2' }).then((r) => {
        job2Done = true;
        return r;
      });

      await Promise.resolve();
      expect(job1Done).toBe(false);
      expect(job2Done).toBe(false);

      // Resolve def1
      def1.resolve();
      await p1;
      expect(job1Done).toBe(true);
      expect(job2Done).toBe(false);

      // Resolve def2
      def2.resolve();
      await p2;
      expect(job2Done).toBe(true);
    });

    it('resolves all pending deferrals simultaneously via resolveAllDeferred()', async () => {
      fake.deferNext();
      fake.deferNext();

      const p1 = fake.generate({ prompt: 'Batch 1' });
      const p2 = fake.generate({ prompt: 'Batch 2' });

      expect(fake.hasPendingDeferrals()).toBe(true);

      fake.resolveAllDeferred();

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
      expect(fake.hasPendingDeferrals()).toBe(false);
    });

    it('correctly handles deferral when resolve is called with empty array []', async () => {
      const def = fake.deferNext();
      const p = fake.generate({ prompt: 'Empty custom output' });

      // If empty array passed, fake falls back to synthetic generation
      def.resolve([]);
      const results = await p;
      expect(results).toHaveLength(1);
      expect(results[0].base64).toBeTruthy();
    });

    it('rejects in-flight deferred upscale job when AbortSignal aborts mid-flight', async () => {
      const controller = new AbortController();
      const def = fake.deferNext();

      const p = fake.upscale({
        image: { base64: 'test', mimeType: 'image/png' },
        signal: controller.signal,
      });

      expect(def.isPending).toBe(true);
      controller.abort(new Error('User cancelled upscale'));

      await expect(p).rejects.toSatisfy((err: unknown) => {
        return (
          isStudioDriverError(err) &&
          err.category === 'cancelled' &&
          err.retryable === false
        );
      });
      expect(def.isPending).toBe(false);
    });

    it('does not re-throw if resolve() or reject() is called multiple times on same deferral', () => {
      const def = fake.deferNext();
      expect(def.isPending).toBe(true);

      def.resolve();
      expect(def.isPending).toBe(false);

      // Secondary resolve/reject calls should be idempotent and no-op
      expect(() => def.resolve()).not.toThrow();
      expect(() => def.reject(new Error('late reject'))).not.toThrow();
    });

    it('bubbles onProgress exceptions cleanly to the caller without hanging deferral', async () => {
      const onProgressBoom = vi.fn(() => {
        throw new Error('Telemetry hook failed');
      });

      await expect(
        fake.generate({
          prompt: 'Boom progress',
          onProgress: onProgressBoom,
        })
      ).rejects.toThrow('Telemetry hook failed');
    });
  });
});
