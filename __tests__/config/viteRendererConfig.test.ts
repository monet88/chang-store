// @vitest-environment node

import type { UserConfig } from 'vite';
import { createRendererConfig } from '../../vite.config';

/** Vite accepts plugin arrays in several shapes; name the ones we can see. */
const pluginNames = (config: UserConfig): string[] =>
  (config.plugins ?? []).map((plugin) => {
    if (plugin && typeof plugin === 'object' && 'name' in plugin) {
      return String(plugin.name);
    }
    return '';
  });

/**
 * The dev server is how this app gets tested (a browser, a phone on the
 * tailnet), so LAN binding is the default. The opt-out exists for shared
 * networks, and both directions are worth pinning: a silent flip either way
 * breaks remote testing or quietly exposes the dev server. The Local Qwen
 * bridge is the opposite default — off, because it spends the machine's GPU
 * for whoever reaches it.
 */
describe('renderer dev server binding', () => {
  afterEach(() => {
    delete process.env.VITE_ENABLE_LAN;
    delete process.env.LOCAL_QWEN_DEV_BRIDGE;
  });

  it('listens on every interface by default', () => {
    expect(createRendererConfig('development').server?.host).toBe('0.0.0.0');
  });

  it('binds loopback only when LAN access is explicitly turned off', () => {
    process.env.VITE_ENABLE_LAN = 'false';

    expect(createRendererConfig('development').server?.host).toBe('127.0.0.1');
  });

  it('keeps the Local Qwen dev bridge off unless it is opted into', () => {
    expect(pluginNames(createRendererConfig('development'))).not.toContain(
      'changstore-local-qwen-dev-bridge',
    );

    process.env.LOCAL_QWEN_DEV_BRIDGE = 'true';

    expect(pluginNames(createRendererConfig('development'))).toContain(
      'changstore-local-qwen-dev-bridge',
    );
  });

  it('keeps the Local Qwen dev bridge off the desktop renderer config', () => {
    process.env.LOCAL_QWEN_DEV_BRIDGE = 'true';

    expect(pluginNames(createRendererConfig('production', { desktop: true }))).not.toContain(
      'changstore-local-qwen-dev-bridge',
    );
  });

  it('tells the renderer the same flag the server used', () => {
    const define = (config: UserConfig) => config.define as Record<string, string>;

    expect(define(createRendererConfig('development'))['import.meta.env.LOCAL_QWEN_DEV_BRIDGE']).toBe('false');

    process.env.LOCAL_QWEN_DEV_BRIDGE = 'true';

    expect(define(createRendererConfig('development'))['import.meta.env.LOCAL_QWEN_DEV_BRIDGE']).toBe('true');
    // Desktop answers through the preload, so the renderer must not look for a
    // dev server that will never be there.
    expect(define(createRendererConfig('production', { desktop: true }))['import.meta.env.LOCAL_QWEN_DEV_BRIDGE']).toBe('false');
  });
});
