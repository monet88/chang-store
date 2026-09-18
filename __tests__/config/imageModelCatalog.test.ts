import { describe, expect, it } from 'vitest';
import {
  CPA_GATEWAY_HOST, IMAGE_DRIVERS, IMAGE_MODEL_CATALOG, RE_VERIFY, XOMPET_GATEWAY_HOST,
  isVerifiedModel, requireImageModelDescriptor, resolveCapabilities,
  type ImageDriverId, type ImageModelDescriptor,
} from '@/config/imageModelCatalog';
import {
  DEFAULT_GPT_IMAGE_MODEL, DEFAULT_GPT_IMAGE_QUALITY, DEFAULT_GPT_IMAGE_SIZE,
  GPT_IMAGE_MODELS, GPT_IMAGE_QUALITIES, GPT_IMAGE_SIZES,
} from '@/config/gptImageModelRegistry';
import { DEFAULT_MODEL_BY_SELECTION_TYPE, MODEL_REGISTRY, getModelCapabilities } from '@/config/modelRegistry';

const SUNBURST = requireImageModelDescriptor('gpt-image-2.5-sunburst');
const GEMINI_IMAGE = requireImageModelDescriptor('gemini-3.1-flash-image');
const GPT_IMAGE_2 = requireImageModelDescriptor('gpt-image-2');
const UNMEASURED = requireImageModelDescriptor('gpt-image-1.5');
const ratiosOnly: ImageDriverId[] = ['gemini-native'];

/** Every capability set a consumer can reach for a row: its defaults plus one per override host. */
const reachableCapabilities = (descriptor: ImageModelDescriptor) => [
  resolveCapabilities(descriptor),
  ...Object.keys(descriptor.gatewayOverrides ?? {}).map((host) => resolveCapabilities(descriptor, host)),
];

describe('image model catalog invariants', () => {
  it('invariant 1: keeps model ids unique and every defaultSize inside its own sizes', () => {
    expect(new Set(IMAGE_MODEL_CATALOG.map((entry) => entry.modelId)).size).toBe(IMAGE_MODEL_CATALOG.length);
    for (const descriptor of IMAGE_MODEL_CATALOG) {
      for (const capabilities of reachableCapabilities(descriptor)) {
        expect(capabilities.sizes.length).toBeGreaterThan(0);
        expect(capabilities.sizes).toContain(capabilities.defaultSize);
      }
    }
  });

  it('invariant 2: matches the size vocabulary its sizeMode declares', () => {
    for (const descriptor of IMAGE_MODEL_CATALOG) {
      for (const capabilities of reachableCapabilities(descriptor)) {
        const pattern = capabilities.sizeMode === 'pixel' ? /^\d+x\d+$/ : /^\d+:\d+$/;
        [...capabilities.sizes, capabilities.defaultSize].forEach((size) => expect(size).toMatch(pattern));
      }
    }
  });

  it('invariant 3: ratio-only drivers never declare a pixel size mode', () => {
    IMAGE_MODEL_CATALOG.filter((entry) => ratiosOnly.includes(resolveCapabilities(entry).driver))
      .forEach((entry) => expect(resolveCapabilities(entry).sizeMode).toBe('ratio'));
  });

  it('invariant 4: keeps a flaky size claim visible with its observed rate', () => {
    const flaky = IMAGE_MODEL_CATALOG.filter((entry) => resolveCapabilities(entry).honorsSize === 'flaky');
    expect(flaky.map((entry) => entry.modelId)).toEqual(['gpt-image-2.5-sunburst']);

    const { sizeObservations } = resolveCapabilities(SUNBURST, XOMPET_GATEWAY_HOST);
    expect(sizeObservations).toEqual({ honored: 2, total: 3 });
    // flaky means "sometimes" — a full rate would be 'yes', a zero rate would be 'no'
    expect(sizeObservations?.honored ?? 0).toBeGreaterThan(0);
    expect(sizeObservations?.honored ?? 0).toBeLessThan(sizeObservations?.total ?? 0);

  });

  it('invariant 5: dates every row with a live probe or the re-verify sentinel', () => {
    for (const descriptor of IMAGE_MODEL_CATALOG) {
      for (const capabilities of reachableCapabilities(descriptor)) {
        expect(capabilities.verifiedAt).toMatch(/^(\d{4}-\d{2}-\d{2}|re-verify)$/);
      }
    }
    expect(isVerifiedModel(SUNBURST)).toBe(true);
    expect(isVerifiedModel(GEMINI_IMAGE)).toBe(true);
    expect(isVerifiedModel(UNMEASURED)).toBe(false);
    expect(resolveCapabilities(UNMEASURED).verifiedAt).toBe(RE_VERIFY);
  });

  it('invariant 6: maps every driver onto an existing seam, exhaustively', () => {
    expect(IMAGE_DRIVERS).toEqual({
      'gemini-native': { lane: 'gemini', seam: 'gemini-adapter' },
      'openai-images': { lane: 'image', seam: 'provider-driver' },
    });
    const catalogDrivers = new Set(IMAGE_MODEL_CATALOG.map((entry) => resolveCapabilities(entry).driver));
    expect([...catalogDrivers].sort()).toEqual(['gemini-native', 'openai-images']);
  });

  it('invariant 7: every openai-images row stays inside its one adapter tolerance', () => {
    const shapes = new Set<string>();
    for (const descriptor of IMAGE_MODEL_CATALOG) {
      const capabilities = reachableCapabilities(descriptor).filter((caps) => caps.driver === 'openai-images');
      for (const caps of capabilities) {
        expect(caps.responseShapes.length).toBeGreaterThan(0);
        caps.responseShapes.forEach((shape) => shapes.add(shape));
      }
    }
    expect([...shapes].sort()).toEqual(['b64_json', 'echo_fields', 'url']);
  });

  it('invariant 8: keys overrides by bare host, each with its own evidence date', () => {
    for (const descriptor of IMAGE_MODEL_CATALOG) {
      for (const [host, override] of Object.entries(descriptor.gatewayOverrides ?? {})) {
        expect(host).toMatch(/^[a-z0-9.-]+(:\d+)?$/); // bare host: no scheme, no path
        expect(override.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // a merged set has exactly one evidence date: the override's
        expect(resolveCapabilities(descriptor, host).verifiedAt).toBe(override.verifiedAt);
      }
    }
  });

  it('invariant 9: resolves capabilities per host, never sharing a mutable set', () => {
    const noHost = resolveCapabilities(SUNBURST);
    expect(noHost).not.toBe(resolveCapabilities(SUNBURST));
    expect(resolveCapabilities(SUNBURST, XOMPET_GATEWAY_HOST)).toEqual(noHost);
    expect(resolveCapabilities(SUNBURST, 'unknown.gateway.test')).toEqual(noHost);

    expect(resolveCapabilities(GPT_IMAGE_2)).toMatchObject({
      driver: 'openai-images', sizeMode: 'pixel', sizes: ['1024x1024', '1536x1024', '1024x1536'], defaultSize: '1024x1024',
    });
    expect(resolveCapabilities(GPT_IMAGE_2, CPA_GATEWAY_HOST)).toMatchObject({
      honorsSize: 'no', supportsTransparentBackground: true,
    });
  });

  it('invariant 10: assigns each driver exactly one lane and never mixes them', () => {
    expect(Object.values(IMAGE_DRIVERS).filter((driver) => driver.lane === 'gemini')).toHaveLength(1);
    for (const descriptor of IMAGE_MODEL_CATALOG) {
      const lane = IMAGE_DRIVERS[resolveCapabilities(descriptor).driver].lane;
      expect(lane === 'gemini' ? descriptor.providerId === 'google' : descriptor.providerId !== 'google').toBe(true);
    }
  });

  it('invariant 11: keeps CPA facts out of the image lane defaults', () => {
    for (const descriptor of IMAGE_MODEL_CATALOG) {
      if (descriptor.gatewayOverrides?.[CPA_GATEWAY_HOST]) {
        // wherever the CPA gateway is used for OpenAI Images work it ignores size
        expect(resolveCapabilities(descriptor, CPA_GATEWAY_HOST).honorsSize).toBe('no');
      }
    }
    expect(resolveCapabilities(SUNBURST, XOMPET_GATEWAY_HOST).honorsSize).toBe('flaky');
    expect(resolveCapabilities(SUNBURST, CPA_GATEWAY_HOST).honorsSize).toBe('no');
    // the CPA gateway owns the gemini lane, where its measurement is the row's own evidence
    expect(IMAGE_DRIVERS[resolveCapabilities(GEMINI_IMAGE).driver].lane).toBe('gemini');
  });
});

describe('registry projections keep phase 1 behavior', () => {
  it('lists exactly the models the studios listed before the catalog existed', () => {
    expect(GPT_IMAGE_MODELS).toEqual([{ modelId: 'gpt-image-2', label: 'GPT Image 2' }]);
    expect(DEFAULT_GPT_IMAGE_MODEL).toBe('gpt-image-2');
    expect(GPT_IMAGE_SIZES).toEqual(['auto', '1024x1024', '1536x1024', '1024x1536']);
    expect(DEFAULT_GPT_IMAGE_SIZE).toBe('1024x1024');
    expect(GPT_IMAGE_QUALITIES).toEqual(['low', 'medium', 'high', 'auto']);
    expect(DEFAULT_GPT_IMAGE_QUALITY).toBe('high');


    const listed = [
      ...GPT_IMAGE_MODELS.map((model) => model.modelId),
      ...MODEL_REGISTRY.map((model) => model.modelId),
    ];
    expect(listed).not.toContain('gpt-image-2.5-sunburst');
    expect(listed).not.toContain('agy/gemini-3.1-flash-image');
  });

  it('keeps the Gemini registry, its capabilities and its defaults unchanged', () => {
    expect(MODEL_REGISTRY.map((model) => model.modelId)).toEqual([
      'gemini-3.1-flash-image',
      'gemini-3.1-flash-image',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-pro',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ]);
    expect(MODEL_REGISTRY.every((model) => model.providerId === 'google')).toBe(true);
    expect(DEFAULT_MODEL_BY_SELECTION_TYPE).toEqual({
      imageEdit: 'gemini-3.1-flash-image',
      imageGenerate: 'gemini-3.1-flash-image',
      textGenerate: 'gemini-3.8-flash',
    });
    expect(getModelCapabilities('gemini-3.1-flash-image')).toEqual({
      supportsImageSize: true,
      supportsAspectRatio: true,
    });
  });
});
