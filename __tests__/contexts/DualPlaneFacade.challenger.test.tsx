import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

import type { StudioMode, ImageFile, ImageAspectRatio, ImageResolution } from '../../src/types';
import {
  ImageEngineProvider,
  ImageEngineContext,
  useImageEngine,
  useOptionalImageEngine,
  createLegacyDriverBridge,
} from '../../src/contexts/ImageEngineContext';
import {
  useImageDriver,
  useOptionalImageDriver,
  ImageDriverProvider,
} from '../../src/contexts/useImageDriver';
import * as DriverContextExports from '../../src/contexts/useImageDriver';
import {
  StudioDriverError as RealStudioDriverError,
  isStudioDriverError as isRealStudioDriverError,
} from '../../src/services/providers/ImageDriver';
import { GeminiImageDriverAdapter } from '../../src/services/providers/gemini/GeminiImageDriverAdapter';
import { GptImageDriverAdapter } from '../../src/services/providers/gpt-image/GptImageDriverAdapter';
import { LocalQwenImageDriverAdapter } from '../../src/services/providers/local-qwen/LocalQwenImageDriverAdapter';
import { InMemoryImageDriverFake } from '../../src/services/providers/testing/InMemoryImageDriverFake';

vi.mock('@/contexts/ApiProviderContext', async () => {
  const { mockUseApi } = await import('../__mocks__/contexts');
  return mockUseApi({
    imageEditModel: 'gemini-3.1-flash-image',
  });
});

describe('Milestone 4 Adversarial Challenger Suite: Dual-Plane Facade & Boundary Stress', () => {

  // ==========================================================================
  // CHALLENGE 1: Architectural Boundary Leak Detection (AST / Filesystem Audit)
  // ==========================================================================
  describe('Boundary Leak Detection: src/components/ and UI Layer Isolation', () => {
    const componentsDir = path.resolve(__dirname, '../../src/components');
    const appFile = path.resolve(__dirname, '../../src/App.tsx');

    function getAllFiles(dir: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
          getAllFiles(filePath, fileList);
        } else if (/\.(tsx?|jsx?)$/.test(file)) {
          fileList.push(filePath);
        }
      }
      return fileList;
    }

    it('empirically verifies zero files in src/components/ import from src/services/', () => {
      const componentFiles = getAllFiles(componentsDir);
      expect(componentFiles.length).toBeGreaterThan(0);

      const violations: Array<{ file: string; line: number; statement: string }> = [];

      // Regex matches imports/exports from services, e.g.
      // import ... from '../services/...' or from '@/services/...' or require('../services/...')
      const serviceImportPattern = /(?:import|export)\s+.*?\s+from\s+['"]([^'"]*services[^'"]*)['"]|import\s*\(\s*['"]([^'"]*services[^'"]*)['"]\s*\)|require\s*\(\s*['"]([^'"]*services[^'"]*)['"]\s*\)/g;

      for (const filePath of componentFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((lineText, idx) => {
          serviceImportPattern.lastIndex = 0;
          const match = serviceImportPattern.exec(lineText);
          if (match) {
            violations.push({
              file: path.relative(path.resolve(__dirname, '../../'), filePath),
              line: idx + 1,
              statement: lineText.trim(),
            });
          }
        });
      }

      expect(violations).toEqual([]);
    });

    it('empirically verifies src/App.tsx does not directly import from src/services/providers/', () => {
      const content = fs.readFileSync(appFile, 'utf-8');
      const lines = content.split('\n');
      const providerViolations: string[] = [];

      lines.forEach((lineText) => {
        if (/from\s+['"][^'"]*services\/providers[^'"]*['"]/.test(lineText)) {
          providerViolations.push(lineText.trim());
        }
      });

      expect(providerViolations).toEqual([]);
    });

    it('verifies UI components access driver capabilities exclusively through src/contexts/', () => {
      const componentFiles = getAllFiles(componentsDir);
      let contextImportCount = 0;

      for (const filePath of componentFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('useImageDriver') || content.includes('ImageEngineContext')) {
          contextImportCount++;
          // Ensure it imports from contexts
          expect(content).toMatch(/from\s+['"].*contexts(\/.*)?['"]/);
        }
      }

      // At least GptStudio, GptImageOptionsPanel or related UI components consume context facade
      expect(contextImportCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // CHALLENGE 2: Dynamic Mode Switching & Seamless Backend Dispatch
  // ==========================================================================
  describe('Dynamic Mode Switching: gemini <-> gptImage <-> localQwen', () => {

    const ConsumerProbe: React.FC<{
      onProbe: (data: { driver: any; engine: any }) => void;
    }> = ({ onProbe }) => {
      const driver = useImageDriver();
      const engine = useImageEngine();
      onProbe({ driver, engine });
      return <div data-testid="probe-mounted">Mode: {engine.id}</div>;
    };

    it('seamlessly updates active driver instance and UI plane controls across mode switches', () => {
      let probeData: { driver: any; engine: any } | null = null;

      const TestHarness: React.FC<{ initialMode: StudioMode }> = ({ initialMode }) => {
        const [mode, setMode] = useState<StudioMode>(initialMode);
        return (
          <div>
            <button onClick={() => setMode('gemini')}>Set Gemini</button>
            <button onClick={() => setMode('gptImage')}>Set GPT</button>
            <button onClick={() => setMode('localQwen')}>Set LocalQwen</button>
            <ImageEngineProvider mode={mode}>
              <ConsumerProbe onProbe={(data) => { probeData = data; }} />
            </ImageEngineProvider>
          </div>
        );
      };

      const { getByText } = render(<TestHarness initialMode="gemini" />);

      // Phase 1: Gemini Mode
      expect(probeData).not.toBeNull();
      expect(probeData!.engine.id).toBe('gemini');
      expect(probeData!.driver.id).toBe('gemini');
      expect(probeData!.driver).toBeInstanceOf(GeminiImageDriverAdapter);
      expect(probeData!.engine.options).toBeNull();
      expect(probeData!.engine.modelOptions).toBeNull();
      expect(probeData!.engine.setModel).toBeNull();
      expect(typeof probeData!.engine.createImageChatSession).toBe('function');

      // Phase 2: Dynamic Switch to gptImage
      act(() => {
        getByText('Set GPT').click();
      });

      expect(probeData!.engine.id).toBe('gptImage');
      expect(probeData!.driver.id).toBe('gptImage');
      expect(probeData!.driver).toBeInstanceOf(GptImageDriverAdapter);
      expect(probeData!.engine.options).not.toBeNull();
      expect(probeData!.engine.options.ratios).toEqual(['1:1', '3:4', '9:16']);
      expect(typeof probeData!.engine.options.setQuality).toBe('function');
      expect(typeof probeData!.engine.options.sizeFor).toBe('function');
      expect(typeof probeData!.engine.setModel).toBe('function');
      expect(probeData!.engine.createImageChatSession).toBeNull();

      // Phase 3: Dynamic Switch to localQwen
      act(() => {
        getByText('Set LocalQwen').click();
      });

      expect(probeData!.engine.id).toBe('localQwen');
      expect(probeData!.driver.id).toBe('localQwen');
      expect(probeData!.driver).toBeInstanceOf(LocalQwenImageDriverAdapter);
      expect(probeData!.engine.options).toBeNull();
      expect(probeData!.engine.modelOptions).toBeNull();
      expect(probeData!.engine.setModel).toBeNull();

      // Phase 4: Switch back to Gemini
      act(() => {
        getByText('Set Gemini').click();
      });

      expect(probeData!.engine.id).toBe('gemini');
      expect(probeData!.driver.id).toBe('gemini');
      expect(probeData!.driver).toBeInstanceOf(GeminiImageDriverAdapter);
    });

    it('honors driverOverride across all 3 studio modes and delegates transport seamlessly', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      let probeData: { driver: any; engine: any } | null = null;

      const TestHarness: React.FC<{ mode: StudioMode }> = ({ mode }) => (
        <ImageEngineProvider mode={mode} driverOverride={fakeDriver}>
          <ConsumerProbe onProbe={(data) => { probeData = data; }} />
        </ImageEngineProvider>
      );

      const { rerender } = render(<TestHarness mode="gemini" />);

      // Gemini with override
      expect(probeData!.driver).toBe(fakeDriver);
      expect(probeData!.engine.driver).toBe(fakeDriver);

      const job1 = { prompt: 'Override test gemini', count: 1 };
      const res1 = await probeData!.driver.generate(job1);
      expect(res1.length).toBe(1);
      expect(fakeDriver.getLastDispatchedJob()?.prompt).toBe('Override test gemini');

      // Switch to gptImage with override
      rerender(<TestHarness mode="gptImage" />);
      expect(probeData!.driver).toBe(fakeDriver);
      expect(probeData!.engine.driver).toBe(fakeDriver);
      // But UI plane still retains gptImage options!
      expect(probeData!.engine.options).not.toBeNull();
      expect(probeData!.engine.options.ratios).toEqual(['1:1', '3:4', '9:16']);

      const job2 = { prompt: 'Override test gpt', count: 1 };
      await probeData!.driver.generate(job2);
      expect(fakeDriver.getLastDispatchedJob()?.prompt).toBe('Override test gpt');

      // Switch to localQwen with override
      rerender(<TestHarness mode="localQwen" />);
      expect(probeData!.driver).toBe(fakeDriver);
      expect(probeData!.engine.driver).toBe(fakeDriver);

      const job3 = { prompt: 'Override test localQwen', count: 1 };
      await probeData!.driver.generate(job3);
      expect(fakeDriver.getLastDispatchedJob()?.prompt).toBe('Override test localQwen');
      expect(fakeDriver.dispatchedJobs.length).toBe(3);
    });

    it('survives rapid adversarial mode cycling without state desynchronization', () => {
      let probeData: { driver: any; engine: any } | null = null;

      const TestHarness: React.FC<{ mode: StudioMode }> = ({ mode }) => (
        <ImageEngineProvider mode={mode}>
          <ConsumerProbe onProbe={(data) => { probeData = data; }} />
        </ImageEngineProvider>
      );

      const { rerender } = render(<TestHarness mode="gemini" />);

      const modes: StudioMode[] = [
        'gptImage', 'localQwen', 'gemini', 'localQwen', 'gptImage',
        'gemini', 'gptImage', 'localQwen', 'localQwen', 'gemini'
      ];

      for (const m of modes) {
        rerender(<TestHarness mode={m} />);
        expect(probeData!.engine.id).toBe(m);
        expect(probeData!.driver.id).toBe(m);
      }
    });
  });

  // ==========================================================================
  // CHALLENGE 3: Legacy Driver Bridge Adversarial Stress Testing
  // ==========================================================================
  describe('Legacy Driver Bridge Stress: createLegacyDriverBridge()', () => {
    it('handles completely empty or minimal params without crashing', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const bridge = createLegacyDriverBridge(fakeDriver, 'gemini-default-model');

      const result = await bridge.editImage({} as any);
      expect(result.length).toBe(1);

      const recordedJob = fakeDriver.getLastDispatchedJob();
      expect(recordedJob).toBeDefined();
      expect(recordedJob?.prompt).toBe('');
      expect(recordedJob?.images).toBeUndefined();
      expect(recordedJob?.count).toBe(1);
      expect(recordedJob?.model).toBe('gemini-default-model');
    });

    it('correctly compiles diverse and malformed interleavedParts into prompt and images', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const bridge = createLegacyDriverBridge(fakeDriver);

      // Sub-case 1: Text-only parts
      await bridge.editImage({
        interleavedParts: [
          { text: 'First paragraph description' },
          { text: 'Second spatial constraint: untucked outside waistband' },
        ],
      } as any);

      expect(fakeDriver.getLastDispatchedJob()?.prompt).toBe(
        'First paragraph description\n\nSecond spatial constraint: untucked outside waistband'
      );
      expect(fakeDriver.getLastDispatchedJob()?.images).toBeUndefined();

      // Sub-case 2: Image-only inline parts
      const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      await bridge.editImage({
        interleavedParts: [
          { inlineData: { data: testBase64, mimeType: 'image/png' } },
        ],
      } as any);

      expect(fakeDriver.getLastDispatchedJob()?.prompt).toBe('');
      expect(fakeDriver.getLastDispatchedJob()?.images?.length).toBe(1);
      expect(fakeDriver.getLastDispatchedJob()?.images?.[0].base64).toBe(testBase64);

      // Sub-case 3: Empty array falls back to top-level prompt/images
      await bridge.editImage({
        interleavedParts: [],
        prompt: 'Fallback explicit prompt',
        images: [{ base64: testBase64, mimeType: 'image/png' }],
      } as any);

      expect(fakeDriver.getLastDispatchedJob()?.prompt).toBe('Fallback explicit prompt');
      expect(fakeDriver.getLastDispatchedJob()?.images?.length).toBe(1);
    });

    it('survives huge payloads: 100k char prompt and 100 images without data truncation', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const bridge = createLegacyDriverBridge(fakeDriver);

      const massivePrompt = 'FASHION_PREVIEW_'.repeat(6250); // 100,000 chars
      const sampleImage: ImageFile = {
        base64: 'abc123456789==',
        mimeType: 'image/png',
      };
      const massiveImages: ImageFile[] = Array.from({ length: 100 }, () => ({ ...sampleImage }));

      await bridge.editImage({
        prompt: massivePrompt,
        images: massiveImages,
        numberOfImages: 50,
        aspectRatio: '9:16' as ImageAspectRatio,
        resolution: '4K' as ImageResolution,
        workflow: 'high-volume-stress-workflow',
        negativePrompt: 'blurry, distorted, tuck-in',
      });

      const job = fakeDriver.getLastDispatchedJob()!;
      expect(job.prompt.length).toBe(100000);
      expect(job.images?.length).toBe(100);
      expect(job.count).toBe(50);
      expect(job.aspectRatio).toBe('9:16');
      expect(job.resolution).toBe('4K');
      expect(job.workflow).toBe('high-volume-stress-workflow');
      expect(job.negativePrompt).toBe('blurry, distorted, tuck-in');
    });

    it('propagates cancellation signals (pre-aborted and mid-flight abort) into StudioDriverError', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const bridge = createLegacyDriverBridge(fakeDriver);

      // Pre-aborted signal
      const abortCtrl = new AbortController();
      abortCtrl.abort(new Error('Pre-aborted test'));

      await expect(
        bridge.editImage({ prompt: 'Should fail immediately' }, undefined, undefined, abortCtrl.signal)
      ).rejects.toThrow(RealStudioDriverError);

      await expect(
        bridge.upscaleImage({ base64: 'abc', mimeType: 'image/png' }, undefined, undefined, '2K', abortCtrl.signal)
      ).rejects.toThrow(RealStudioDriverError);

      // Mid-flight abort with deferral
      const deferral = fakeDriver.deferNext();
      const inFlightCtrl = new AbortController();

      const inFlightPromise = bridge.editImage(
        { prompt: 'In flight abort' },
        undefined,
        undefined,
        inFlightCtrl.signal
      );

      expect(deferral.isPending).toBe(true);
      inFlightCtrl.abort('User clicked cancel button');

      await expect(inFlightPromise).rejects.toThrow(RealStudioDriverError);
    });

    it('faithfully streams driver progress steps into legacy config.onStatusUpdate', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const bridge = createLegacyDriverBridge(fakeDriver);

      const statusUpdates: string[] = [];
      const config = {
        onStatusUpdate: (msg: string) => {
          statusUpdates.push(msg);
        },
      };

      await bridge.editImage({ prompt: 'Progress test' }, undefined, config);
      expect(statusUpdates.length).toBeGreaterThanOrEqual(3);
      expect(statusUpdates[0]).toContain('Initializing generation pipeline');

      const upscaleUpdates: string[] = [];
      await bridge.upscaleImage(
        { base64: 'abc', mimeType: 'image/png' },
        undefined,
        { onStatusUpdate: (msg) => upscaleUpdates.push(msg) },
        '4K'
      );
      expect(upscaleUpdates.length).toBeGreaterThanOrEqual(2);
      expect(upscaleUpdates[0]).toContain('Initializing local upscale engine');
    });

    it('translates all StudioDriverError categories back to the caller without swallowing', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const bridge = createLegacyDriverBridge(fakeDriver);

      const errorCategories = [
        'safety_blocked',
        'rate_limited',
        'gateway_down',
        'hardware_error',
        'cancelled',
        'unknown',
      ] as const;

      for (const cat of errorCategories) {
        fakeDriver.queueNextError(
          new RealStudioDriverError(cat, `Simulated error for category: ${cat}`, {
            status: cat === 'rate_limited' ? 429 : 500,
            retryable: cat === 'rate_limited',
          })
        );

        let caughtErr: any = null;
        try {
          await bridge.editImage({ prompt: `Error test ${cat}` });
        } catch (err) {
          caughtErr = err;
        }

        expect(caughtErr).toBeInstanceOf(RealStudioDriverError);
        expect(caughtErr.category).toBe(cat);
        expect(caughtErr.message).toContain(cat);
        expect(isRealStudioDriverError(caughtErr)).toBe(true);
      }
    });

    it('exports functional StudioDriverError and guards from useImageDriver seam', () => {
      expect(typeof DriverContextExports.StudioDriverError).toBe('function');
      expect(typeof DriverContextExports.isStudioDriverError).toBe('function');
      expect(typeof DriverContextExports.isRetryableDriverError).toBe('function');

      const err = new DriverContextExports.StudioDriverError('hardware_error', 'comfy oom');
      expect(DriverContextExports.isStudioDriverError(err)).toBe(true);
      expect(DriverContextExports.isRetryableDriverError(err)).toBe(false);
      expect(err instanceof DriverContextExports.StudioDriverError).toBe(true);
    });



    it('robustly normalizes upscale quality parameter variants', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const bridge = createLegacyDriverBridge(fakeDriver);

      const dummyImage: ImageFile = { base64: 'preview', mimeType: 'image/png' };

      // 4K
      await bridge.upscaleImage(dummyImage, undefined, undefined, '4K');
      expect(fakeDriver.getLastDispatchedUpscaleJob()?.quality).toBe('4K');

      // 2K
      await bridge.upscaleImage(dummyImage, undefined, undefined, '2K');
      expect(fakeDriver.getLastDispatchedUpscaleJob()?.quality).toBe('2K');

      // Undefined defaults to 2K
      await bridge.upscaleImage(dummyImage, undefined, undefined, undefined as any);
      expect(fakeDriver.getLastDispatchedUpscaleJob()?.quality).toBe('2K');

      // Garbage string defaults to 2K
      await bridge.upscaleImage(dummyImage, undefined, undefined, 'invalidQualityString' as any);
      expect(fakeDriver.getLastDispatchedUpscaleJob()?.quality).toBe('2K');
    });
  });

  // ==========================================================================
  // CHALLENGE 4: Hook Resolution, Standalone Providers & Mock Synthesizer
  // ==========================================================================
  describe('Hook Resolution and Edge Case Fallbacks: useImageDriver()', () => {
    it('throws informative error when useImageDriver() is called outside any provider', () => {
      expect(() => {
        renderHook(() => useImageDriver());
      }).toThrow('useImageDriver must be used inside ImageDriverProvider or ImageEngineProvider');
    });

    it('returns null when useOptionalImageDriver() is called outside any provider', () => {
      const { result } = renderHook(() => useOptionalImageDriver());
      expect(result.current).toBeNull();
    });

    it('works cleanly with standalone ImageDriverProvider without ImageEngineProvider', async () => {
      const fakeDriver = new InMemoryImageDriverFake('localQwen');

      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ImageDriverProvider driver={fakeDriver}>{children}</ImageDriverProvider>
      );

      const { result } = renderHook(() => useImageDriver(), { wrapper });
      expect(result.current).toBe(fakeDriver);
      expect(result.current.id).toBe('localQwen');

      const images = await result.current.generate({ prompt: 'Standalone test' });
      expect(images.length).toBe(1);
      expect(fakeDriver.getLastDispatchedJob()?.prompt).toBe('Standalone test');
    });

    it('allows nested ImageDriverProvider to override parent ImageEngineProvider', () => {
      const outerFake = new InMemoryImageDriverFake('gemini');
      const innerFake = new InMemoryImageDriverFake('localQwen');

      let innerDriver: any = null;

      render(
        <ImageEngineProvider mode="gemini" driverOverride={outerFake}>
          <ImageDriverProvider driver={innerFake}>
            <ConsumerProbe onProbe={({ driver }) => { innerDriver = driver; }} />
          </ImageDriverProvider>
        </ImageEngineProvider>
      );

      function ConsumerProbe({ onProbe }: { onProbe: (data: { driver: any }) => void }) {
        const driver = useImageDriver();
        onProbe({ driver });
        return <div>Nested probe</div>;
      }

      expect(innerDriver).toBe(innerFake);
      expect(innerDriver.id).toBe('localQwen');
    });

  });

  // ==========================================================================
  // CHALLENGE 5: Deep Destructuring Resilience Across All Concrete Adapters & Facade
  // ==========================================================================
  describe('Adversarial Destructuring Resilience: Unbound Method Invocations', () => {
    const dummyImage: ImageFile = {
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      mimeType: 'image/png',
    };

    it('empirically verifies destructuring { generate, generateOne, upscale } from Gemini adapter without this context', async () => {
      const mockGeminiClient = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [{ inlineData: { data: 'gemini-destructured-output', mimeType: 'image/png' } }],
                },
              },
            ],
          }),
        },
      };

      const geminiAdapter = new GeminiImageDriverAdapter({ client: mockGeminiClient });
      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ImageDriverProvider driver={geminiAdapter}>{children}</ImageDriverProvider>
      );

      const { result } = renderHook(() => useImageDriver(), { wrapper });

      // Destructure completely detached from instance
      const { generate, generateOne, upscale } = result.current;

      // 1. generate() without this
      const genResults = await generate({ prompt: 'Gemini unbound generate' });
      expect(genResults).toHaveLength(1);
      expect(genResults[0].base64).toBe('gemini-destructured-output');

      // 2. generateOne() without this
      const oneResult = await generateOne({ prompt: 'Gemini unbound generateOne' });
      expect(oneResult.base64).toBe('gemini-destructured-output');

      // 3. upscale() without this
      const upResult = await upscale({ image: dummyImage, quality: '2K' });
      expect(upResult.base64).toBe('gemini-destructured-output');

      // Verify adapter internal state was safely accessed and recorded
      const recorded = geminiAdapter.getRecordedJobs();
      expect(recorded).toHaveLength(3);
      expect(recorded[0].prompt).toBe('Gemini unbound generate');
      expect(recorded[1].prompt).toBe('Gemini unbound generateOne');
    });

    it('empirically verifies destructuring { generate, generateOne, upscale } from GPT adapter without this context', async () => {
      const mockGptClient = {
        generateImage: vi.fn().mockResolvedValue([
          { base64: 'gpt-destructured-gen', mimeType: 'image/png' },
        ]),
        editImage: vi.fn().mockResolvedValue([
          { base64: 'gpt-destructured-edit', mimeType: 'image/png' },
        ]),
      };

      const gptAdapter = new GptImageDriverAdapter({
        client: mockGptClient,
        apiKey: 'test-gpt-key',
        baseUrl: 'https://api.openai.com/v1',
      });

      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ImageDriverProvider driver={gptAdapter}>{children}</ImageDriverProvider>
      );

      const { result } = renderHook(() => useImageDriver(), { wrapper });

      // Destructure methods
      const { generate, generateOne, upscale } = result.current;

      // 1. generate() without this
      const genResults = await generate({ prompt: 'GPT unbound generate' });
      expect(genResults).toHaveLength(1);
      expect(genResults[0].base64).toBe('gpt-destructured-gen');

      // 2. generateOne() without this
      const oneResult = await generateOne({ prompt: 'GPT unbound generateOne' });
      expect(oneResult.base64).toBe('gpt-destructured-gen');

      // 3. upscale() without this
      const upResult = await upscale({ image: dummyImage, quality: '2K' });
      expect(upResult.base64).toBe('gpt-destructured-edit');

      // Verify internal state and credentials survived without this loss
      const recorded = gptAdapter.getRecordedJobs();
      expect(recorded).toHaveLength(3);
      expect(recorded[0].prompt).toBe('GPT unbound generate');
    });

    it('empirically verifies destructuring { generate, generateOne, upscale } from LocalQwen adapter without this context', async () => {
      const mockDesktopApi = {
        getStatus: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready', isAppOwned: true, port: 8188 } }),
        startServer: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready', isAppOwned: true, port: 8188 } }),
        stopServer: vi.fn().mockResolvedValue({ ok: true, value: { stopped: true, wasExternal: false } }),
        generateImage: vi.fn().mockResolvedValue({
          ok: true,
          value: { image: { base64: 'localqwen-destructured-gen', mimeType: 'image/png' } },
        }),
        cancelJob: vi.fn().mockResolvedValue({ ok: true, value: { cancelled: true } }),
        upscaleImage: vi.fn().mockResolvedValue({
          ok: true,
          value: { image: 'localqwen-destructured-upscaled', mimeType: 'image/png' },
        }),
      };

      (window as any).desktopLocalQwen = mockDesktopApi;
      try {
        const localAdapter = new LocalQwenImageDriverAdapter();
        const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
          <ImageDriverProvider driver={localAdapter}>{children}</ImageDriverProvider>
        );

        const { result } = renderHook(() => useImageDriver(), { wrapper });

        const { generate, generateOne, upscale } = result.current;

        // 1. generate() without this
        const genResults = await generate({ prompt: 'LocalQwen unbound generate' });
        expect(genResults).toHaveLength(1);
        expect(genResults[0].base64).toBe('localqwen-destructured-gen');

        // 2. generateOne() without this
        const oneResult = await generateOne({ prompt: 'LocalQwen unbound generateOne' });
        expect(oneResult.base64).toBe('localqwen-destructured-gen');

        // 3. upscale() without this
        const upResult = await upscale({ image: dummyImage, quality: '2K' });
        expect(upResult.base64).toBe('localqwen-destructured-upscaled');

        const recorded = localAdapter.getRecordedJobs();
        expect(recorded).toHaveLength(3);
      } finally {
        delete (window as any).desktopLocalQwen;
      }
    });

    it('empirically verifies destructuring from useImageEngine() dual-plane facade', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ImageEngineProvider mode="gemini" driverOverride={fakeDriver}>
          {children}
        </ImageEngineProvider>
      );

      const { result } = renderHook(() => useImageEngine(), { wrapper });
      const { generate, generateOne, upscale, editImage, upscaleImage } = result.current;

      // Transport plane methods detached
      const genResults = await generate({ prompt: 'Facade unbound generate' });
      expect(genResults).toHaveLength(1);

      const oneResult = await generateOne({ prompt: 'Facade unbound generateOne' });
      expect(oneResult.base64).toBeDefined();

      const upResult = await upscale({ image: dummyImage });
      expect(upResult.base64).toBeDefined();

      // Legacy bridge methods detached
      const legacyEdit = await (editImage as any)({ prompt: 'Legacy unbound edit' });
      expect(legacyEdit).toHaveLength(1);

      const legacyUp = await (upscaleImage as any)(dummyImage);
      expect(legacyUp.base64).toBeDefined();

      expect(fakeDriver.dispatchedJobs.length).toBe(3);
      expect(fakeDriver.dispatchedUpscaleJobs.length).toBe(2);
    });

    it('supports higher-order callback passing of destructured driver methods', async () => {
      const fakeDriver = new InMemoryImageDriverFake('gemini');
      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ImageDriverProvider driver={fakeDriver}>{children}</ImageDriverProvider>
      );

      const { result } = renderHook(() => useImageDriver(), { wrapper });
      const { generate } = result.current;

      const jobs = [
        { prompt: 'Batch item 1' },
        { prompt: 'Batch item 2' },
        { prompt: 'Batch item 3' },
      ];

      // Direct passing to Array.map without wrapping in an arrow function
      const batchResults = await Promise.all(jobs.map(generate));
      expect(batchResults).toHaveLength(3);
      expect(fakeDriver.dispatchedJobs).toHaveLength(3);
      expect(fakeDriver.dispatchedJobs.map((j) => j.prompt)).toEqual([
        'Batch item 1',
        'Batch item 2',
        'Batch item 3',
      ]);
    });
  });

  // ==========================================================================
  // CHALLENGE 6: Value Re-export & Guard Predicate Rigor for StudioDriverError
  // ==========================================================================
  describe('StudioDriverError Value Re-export & Invariant Guards', () => {
    it('verifies StudioDriverError and guard functions exported from useImageDriver seam are concrete values', () => {
      const {
        StudioDriverError,
        isStudioDriverError,
        isRetryableDriverError,
      } = DriverContextExports;

      expect(typeof StudioDriverError).toBe('function');
      expect(typeof isStudioDriverError).toBe('function');
      expect(typeof isRetryableDriverError).toBe('function');
      expect(StudioDriverError).toBe(RealStudioDriverError);
      expect(isStudioDriverError).toBe(isRealStudioDriverError);
    });

    it('verifies prototype chain, inheritance, and error categories across all StudioDriverErrorCode variants', () => {
      const { StudioDriverError, isStudioDriverError, isRetryableDriverError } = DriverContextExports;

      const categories = [
        'safety_blocked',
        'rate_limited',
        'gateway_down',
        'hardware_error',
        'cancelled',
        'unknown',
      ] as const;

      for (const cat of categories) {
        const error = new StudioDriverError(cat, `Test message for ${cat}`);
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(StudioDriverError);
        expect(error.name).toBe('StudioDriverError');
        expect(error.category).toBe(cat);
        expect(error.message).toBe(`Test message for ${cat}`);
        expect(isStudioDriverError(error)).toBe(true);
      }
    });

    it('verifies retryable classification semantics via isRetryableDriverError', () => {
      const { StudioDriverError, isRetryableDriverError } = DriverContextExports;

      // 1. rate_limited is automatically retryable
      const rateLimitErr = new StudioDriverError('rate_limited', 'Rate limit hit');
      expect(isRetryableDriverError(rateLimitErr)).toBe(true);

      // 2. hardware_error is strictly non-retryable even with 500 status
      const oomErr = new StudioDriverError('hardware_error', 'CUDA OOM', { status: 500 });
      expect(isRetryableDriverError(oomErr)).toBe(false);

      // 3. gateway_down with status >= 500 is retryable
      const serverErr = new StudioDriverError('gateway_down', 'Bad Gateway', { status: 502 });
      expect(isRetryableDriverError(serverErr)).toBe(true);

      // 4. safety_blocked is strictly non-retryable
      const safetyErr = new StudioDriverError('safety_blocked', 'Safety block', { status: 400 });
      expect(isRetryableDriverError(safetyErr)).toBe(false);

      // 5. Explicit retryable flag overrides default logic
      const explicitTrue = new StudioDriverError('unknown', 'Recoverable unknown', { retryable: true });
      expect(isRetryableDriverError(explicitTrue)).toBe(true);

      const explicitFalse = new StudioDriverError('rate_limited', 'Permanent quota exhaust', { retryable: false });
      expect(isRetryableDriverError(explicitFalse)).toBe(false);
    });

    it('verifies guard functions reject non-StudioDriverError values safely', () => {
      const { isStudioDriverError, isRetryableDriverError } = DriverContextExports;

      const nonStudioErrors = [
        new Error('Generic standard error'),
        new TypeError('Unbound method type error'),
        { name: 'StudioDriverError', category: 'rate_limited' }, // duck object
        null,
        undefined,
        'StudioDriverError: hardware_error',
        42,
        {},
      ];

      for (const candidate of nonStudioErrors) {
        expect(isStudioDriverError(candidate)).toBe(false);
        expect(isRetryableDriverError(candidate)).toBe(false);
      }
    });
  });

  // ==========================================================================
  // CHALLENGE 7: Dynamic Engine Switching with Error Normalization Across Modes
  // ==========================================================================
  describe('Dynamic Engine Switching & Normalized Error Propagation', () => {
    it('preserves StudioDriverError normalization when switching between gemini, gptImage, and localQwen', async () => {
      const { StudioDriverError, isStudioDriverError } = DriverContextExports;

      // 1. Set up simulated adapters with queued/controlled errors
      const geminiFake = new InMemoryImageDriverFake('gemini');
      const gptFake = new InMemoryImageDriverFake('gptImage');
      const localFake = new InMemoryImageDriverFake('localQwen');

      let currentMode: StudioMode = 'gemini';
      const getDriverForMode = (m: StudioMode) => {
        if (m === 'gemini') return geminiFake;
        if (m === 'gptImage') return gptFake;
        return localFake;
      };

      const SwitchableHarness: React.FC<{ mode: StudioMode }> = ({ mode }) => (
        <ImageEngineProvider mode={mode} driverOverride={getDriverForMode(mode)}>
          <ProbeComponent />
        </ImageEngineProvider>
      );

      let activeDriver: any = null;
      function ProbeComponent() {
        activeDriver = useImageDriver();
        return <div>Current: {activeDriver.id}</div>;
      }

      const { rerender } = render(<SwitchableHarness mode="gemini" />);

      // Phase 1: Gemini error propagation
      expect(activeDriver.id).toBe('gemini');
      geminiFake.queueNextError(new StudioDriverError('rate_limited', 'Gemini quota exceeded', { status: 429 }));
      await expect(activeDriver.generate({ prompt: 'gemini err' })).rejects.toSatisfy((err: any) => {
        return isStudioDriverError(err) && err.category === 'rate_limited';
      });

      // Phase 2: Dynamic switch to gptImage and verify gpt error propagation
      rerender(<SwitchableHarness mode="gptImage" />);
      expect(activeDriver.id).toBe('gptImage');
      gptFake.queueNextError(new StudioDriverError('safety_blocked', 'GPT policy violation', { status: 400 }));
      await expect(activeDriver.generate({ prompt: 'gpt err' })).rejects.toSatisfy((err: any) => {
        return isStudioDriverError(err) && err.category === 'safety_blocked';
      });

      // Phase 3: Dynamic switch to localQwen and verify hardware error propagation
      rerender(<SwitchableHarness mode="localQwen" />);
      expect(activeDriver.id).toBe('localQwen');
      localFake.queueNextError(new StudioDriverError('hardware_error', 'ComfyUI CUDA out of memory'));
      await expect(activeDriver.generate({ prompt: 'local err' })).rejects.toSatisfy((err: any) => {
        return isStudioDriverError(err) && err.category === 'hardware_error' && err.retryable === false;
      });

      // Phase 4: Dynamic switch back to Gemini and verify recovery with clean generation
      rerender(<SwitchableHarness mode="gemini" />);
      expect(activeDriver.id).toBe('gemini');
      const cleanResult = await activeDriver.generate({ prompt: 'Recovered cleanly' });
      expect(cleanResult).toHaveLength(1);
      expect(geminiFake.getLastDispatchedJob()?.prompt).toBe('Recovered cleanly');
    });
  });

});

