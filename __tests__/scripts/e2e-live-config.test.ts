import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

import { getLiveE2EConfig } from '../../scripts/e2e-live/config';

const repoRoot = resolve(__dirname, '../..');

describe('e2e live config', () => {
  it('requires gateway and API key from environment', () => {
    const originalBaseUrl = process.env.E2E_LIVE_BASE_URL;
    const originalApiKey = process.env.E2E_LIVE_API_KEY;

    delete process.env.E2E_LIVE_BASE_URL;
    delete process.env.E2E_LIVE_API_KEY;

    try {
      expect(() => getLiveE2EConfig()).toThrow('E2E_LIVE_BASE_URL is required.');
      process.env.E2E_LIVE_BASE_URL = 'https://vertex.monet.uno/gemini';
      expect(() => getLiveE2EConfig()).toThrow('E2E_LIVE_API_KEY is required.');
    } finally {
      if (originalBaseUrl === undefined) {
        delete process.env.E2E_LIVE_BASE_URL;
      } else {
        process.env.E2E_LIVE_BASE_URL = originalBaseUrl;
      }

      if (originalApiKey === undefined) {
        delete process.env.E2E_LIVE_API_KEY;
      } else {
        process.env.E2E_LIVE_API_KEY = originalApiKey;
      }
    }
  });

  it('rejects untrusted remote gateways before sending the API key', () => {
    const originalBaseUrl = process.env.E2E_LIVE_BASE_URL;
    const originalApiKey = process.env.E2E_LIVE_API_KEY;

    process.env.E2E_LIVE_BASE_URL = 'https://evil.example/gemini';
    process.env.E2E_LIVE_API_KEY = 'secret';

    try {
      expect(() => getLiveE2EConfig()).toThrow('E2E_LIVE_BASE_URL must use a trusted host.');
    } finally {
      if (originalBaseUrl === undefined) {
        delete process.env.E2E_LIVE_BASE_URL;
      } else {
        process.env.E2E_LIVE_BASE_URL = originalBaseUrl;
      }

      if (originalApiKey === undefined) {
        delete process.env.E2E_LIVE_API_KEY;
      } else {
        process.env.E2E_LIVE_API_KEY = originalApiKey;
      }
    }
  });

  it('defaults image and output directories relative to the script', () => {
    const originalBaseUrl = process.env.E2E_LIVE_BASE_URL;
    const originalApiKey = process.env.E2E_LIVE_API_KEY;
    const originalImgDir = process.env.E2E_LIVE_IMG_DIR;
    const originalOutDir = process.env.E2E_LIVE_OUT_DIR;

    process.env.E2E_LIVE_BASE_URL = 'https://vertex.monet.uno/gemini';
    process.env.E2E_LIVE_API_KEY = 'secret';
    delete process.env.E2E_LIVE_IMG_DIR;
    delete process.env.E2E_LIVE_OUT_DIR;

    try {
      expect(getLiveE2EConfig()).toMatchObject({
        imgDir: resolve(repoRoot, 'docs/image-test'),
        outDir: resolve(repoRoot, 'scripts/e2e-live/output'),
      });
    } finally {
      if (originalBaseUrl === undefined) {
        delete process.env.E2E_LIVE_BASE_URL;
      } else {
        process.env.E2E_LIVE_BASE_URL = originalBaseUrl;
      }

      if (originalApiKey === undefined) {
        delete process.env.E2E_LIVE_API_KEY;
      } else {
        process.env.E2E_LIVE_API_KEY = originalApiKey;
      }

      if (originalImgDir === undefined) {
        delete process.env.E2E_LIVE_IMG_DIR;
      } else {
        process.env.E2E_LIVE_IMG_DIR = originalImgDir;
      }

      if (originalOutDir === undefined) {
        delete process.env.E2E_LIVE_OUT_DIR;
      } else {
        process.env.E2E_LIVE_OUT_DIR = originalOutDir;
      }
    }
  });
});
