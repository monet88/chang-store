import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LiveE2EConfig {
  gateway: string;
  apiKey: string;
  imgDir: string;
  outDir: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRUSTED_LIVE_E2E_HOSTS = new Set(['vertex.monet.uno']);

const getRequiredEnv = (key: 'E2E_LIVE_BASE_URL' | 'E2E_LIVE_API_KEY'): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
};

const getTrustedGateway = (): string => {
  const value = getRequiredEnv('E2E_LIVE_BASE_URL');
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error('E2E_LIVE_BASE_URL must be a valid URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('E2E_LIVE_BASE_URL must use https.');
  }

  if (!TRUSTED_LIVE_E2E_HOSTS.has(parsed.host)) {
    throw new Error('E2E_LIVE_BASE_URL must use a trusted host.');
  }

  return value;
};

export const getLiveE2EConfig = (): LiveE2EConfig => ({
  gateway: getTrustedGateway(),
  apiKey: getRequiredEnv('E2E_LIVE_API_KEY'),
  imgDir: process.env.E2E_LIVE_IMG_DIR?.trim() || resolve(__dirname, '../../docs/image-test'),
  outDir: process.env.E2E_LIVE_OUT_DIR?.trim() || resolve(__dirname, 'output'),
});
