import { describe, expect, it, vi } from 'vitest';
import { handleLocalQwenDevRequest } from '../../vite-plugins/localQwenDevBridge';
import type { LocalQwenManager } from '../../electron/localQwenManager';

/**
 * The dev bridge stands in for the Electron IPC transport, so every action has
 * to reach the same manager method with the same parsed payload. A typo in an
 * action name would otherwise only show up as "Local Qwen is not available"
 * in a browser.
 */
const createManager = () => {
  const manager = {
    getStatus: vi.fn().mockResolvedValue({ state: 'ready' }),
    startServer: vi.fn().mockResolvedValue({ state: 'ready' }),
    stopServer: vi.fn().mockResolvedValue({ stopped: true }),
    generateImage: vi.fn().mockResolvedValue({ image: { base64: 'x', mimeType: 'image/png' } }),
    cancelJob: vi.fn().mockResolvedValue({ cancelled: true }),
    upscaleImage: vi.fn().mockResolvedValue({ image: { base64: 'y', mimeType: 'image/png' } }),
    checkFolder: vi.fn().mockResolvedValue({ exists: true }),
  };
  return manager as unknown as LocalQwenManager & typeof manager;
};

describe('handleLocalQwenDevRequest', () => {
  it('routes every action to its manager method', async () => {
    const manager = createManager();

    await handleLocalQwenDevRequest(manager, 'getStatus', 'D:/ComfyUI');
    await handleLocalQwenDevRequest(manager, 'startServer', 'D:/ComfyUI');
    await handleLocalQwenDevRequest(manager, 'stopServer', undefined);
    await handleLocalQwenDevRequest(manager, 'generateImage', {
      prompt: 'a studio look',
      images: [{ base64: 'AAA', mimeType: 'image/png' }],
    });
    await handleLocalQwenDevRequest(manager, 'cancelJob', undefined);
    await handleLocalQwenDevRequest(manager, 'upscaleImage', { image: 'AAA' });
    await handleLocalQwenDevRequest(manager, 'verifyFolder', 'D:/ComfyUI');

    expect(manager.getStatus).toHaveBeenCalledWith('D:/ComfyUI');
    expect(manager.startServer).toHaveBeenCalledWith('D:/ComfyUI');
    expect(manager.stopServer).toHaveBeenCalled();
    expect(manager.generateImage).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'a studio look' }));
    expect(manager.cancelJob).toHaveBeenCalled();
    expect(manager.upscaleImage).toHaveBeenCalledWith(expect.objectContaining({ image: 'AAA' }));
    expect(manager.checkFolder).toHaveBeenCalledWith('D:/ComfyUI');
  });

  it('rejects an unknown action without touching the manager', async () => {
    const manager = createManager();

    const result = await handleLocalQwenDevRequest(manager, 'dropDatabase', undefined);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.message).toContain('dropDatabase');
    expect(manager.getStatus).not.toHaveBeenCalled();
  });

  it('returns a failed envelope when the manager throws', async () => {
    const manager = createManager();
    manager.startServer.mockRejectedValueOnce(new Error('ComfyUI directory not found: D:/nope'));

    const result = await handleLocalQwenDevRequest(manager, 'startServer', 'D:/nope');

    expect(result).toEqual({ ok: false, error: { message: 'ComfyUI directory not found: D:/nope' } });
  });
});
