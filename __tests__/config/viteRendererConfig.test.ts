// @vitest-environment node

import type { UserConfig } from 'vite';
import { createRendererConfig } from '../../vite.config';

/**
 * The dev server is how this app gets tested (a browser, a phone on the
 * tailnet), so LAN binding is the default. The opt-out exists for shared
 * networks, and both directions are worth pinning: a silent flip either way
 * breaks remote testing or quietly exposes the dev server.
 */
const pluginNames = (config: UserConfig): string[] =>
  (config.plugins ?? []).map((plugin) => {
    if (plugin && typeof plugin === 'object' && 'name' in plugin) {
      return String(plugin.name);
    }
    return '';
  });

describe('renderer dev server binding', () => {
  afterEach(() => {
    delete process.env.VITE_ENABLE_LAN;
  });

  it('listens on every interface by default', () => {
    expect(createRendererConfig('development').server?.host).toBe('0.0.0.0');
  });

  it('binds loopback only when LAN access is explicitly turned off', () => {
    process.env.VITE_ENABLE_LAN = 'false';

    expect(createRendererConfig('development').server?.host).toBe('127.0.0.1');
  });

  it('keeps the Local Qwen dev bridge off the desktop renderer config', () => {
    expect(pluginNames(createRendererConfig('development'))).toContain(
      'changstore-local-qwen-dev-bridge',
    );
    expect(pluginNames(createRendererConfig('production', { desktop: true }))).not.toContain(
      'changstore-local-qwen-dev-bridge',
    );
  });
});
