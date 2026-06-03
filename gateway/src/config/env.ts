import fs from 'node:fs';
import { loadServiceAccountCredential } from '../auth/google-auth.js';

export interface GatewayConfig {
  port: number;
  gatewayKeys: string[];
  corsOrigins: string[];
  googleProject: string;
  googleLocation: string;
  googleCredentialsFile: string | null;
  googleApiVersion: string;
  maxJsonBytes: number;
  maxImages: number;
  maxDecodedImageBytes: number;
  upstreamTimeoutMs: number;
  upstreamConcurrency: number;
  enableGeminiRoutes: boolean;
  enableVertexRoutes: boolean;
  enableVtxRoutes: boolean;
  enableImageRoutes: boolean;
}

const DEFAULTS = {
  port: 8080,
  googleLocation: 'us-central1',
  googleApiVersion: 'v1',
  maxJsonBytes: 8 * 1024 * 1024,
  maxImages: 4,
  maxDecodedImageBytes: 6 * 1024 * 1024,
  upstreamTimeoutMs: 45_000,
  upstreamConcurrency: 4,
};

const splitList = (value: string | undefined): string[] =>
  value?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? [];

type GatewayFileConfig = Partial<{
  port: number;
  gatewayKeys: string[];
  corsOrigins: string[];
  googleProject: string;
  googleLocation: string;
  googleCredentialsFile: string | null;
  googleApiVersion: string;
  maxJsonBytes: number;
  maxImages: number;
  maxDecodedImageBytes: number;
  upstreamTimeoutMs: number;
  upstreamConcurrency: number;
  enableGeminiRoutes: boolean;
  enableVertexRoutes: boolean;
  enableVtxRoutes: boolean;
  enableImageRoutes: boolean;
}>;

const normalizeScalar = (value: string): string | number | boolean | null => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed) ? numeric : trimmed;
};

const loadFileConfig = (): GatewayFileConfig => {
  const filePath = process.env.GATEWAY_CONFIG_FILE?.trim();
  if (!filePath) return {};
  const source = fs.readFileSync(filePath, 'utf8');
  const config: Record<string, unknown> = {};
  let currentListKey: string | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '');
    if (!line.trim()) continue;

    const listItem = line.match(/^\s*-\s*(.+?)\s*$/);
    if (listItem && currentListKey) {
      const value = normalizeScalar(listItem[1]);
      const list = Array.isArray(config[currentListKey]) ? (config[currentListKey] as unknown[]) : [];
      list.push(String(value));
      config[currentListKey] = list;
      continue;
    }

    const entry = line.match(/^([A-Za-z0-9]+):\s*(.*)$/);
    if (!entry) {
      throw new Error(`Invalid ${filePath}: unsupported line "${rawLine.trim()}"`);
    }

    const [, key, rawValue] = entry;
    if (!rawValue.trim()) {
      config[key] = [];
      currentListKey = key;
      continue;
    }

    config[key] = normalizeScalar(rawValue);
    currentListKey = null;
  }

  return config as GatewayFileConfig;
};

const boolEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const numberEnv = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: expected a positive number.`);
  }
  return value;
};

export const loadConfig = (): GatewayConfig => {
  const fileConfig = loadFileConfig();
  const googleProject = (
    process.env.GOOGLE_VERTEX_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    fileConfig.googleProject ??
    ''
  ).trim();

  const config: GatewayConfig = {
    port: numberEnv('PORT', fileConfig.port ?? DEFAULTS.port),
    gatewayKeys: splitList(process.env.GATEWAY_API_KEYS).length > 0
      ? splitList(process.env.GATEWAY_API_KEYS)
      : (fileConfig.gatewayKeys ?? []),
    corsOrigins: splitList(process.env.GATEWAY_CORS_ORIGINS).length > 0
      ? splitList(process.env.GATEWAY_CORS_ORIGINS)
      : (fileConfig.corsOrigins ?? []),
    googleProject,
    googleLocation: process.env.GOOGLE_VERTEX_LOCATION?.trim() || fileConfig.googleLocation || DEFAULTS.googleLocation,
    googleCredentialsFile: process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || fileConfig.googleCredentialsFile || null,
    googleApiVersion: process.env.GOOGLE_GENAI_API_VERSION?.trim() || fileConfig.googleApiVersion || DEFAULTS.googleApiVersion,
    maxJsonBytes: numberEnv('GATEWAY_MAX_JSON_BYTES', fileConfig.maxJsonBytes ?? DEFAULTS.maxJsonBytes),
    maxImages: numberEnv('GATEWAY_MAX_IMAGES', fileConfig.maxImages ?? DEFAULTS.maxImages),
    maxDecodedImageBytes: numberEnv('GATEWAY_MAX_DECODED_IMAGE_BYTES', fileConfig.maxDecodedImageBytes ?? DEFAULTS.maxDecodedImageBytes),
    upstreamTimeoutMs: numberEnv('GATEWAY_UPSTREAM_TIMEOUT_MS', fileConfig.upstreamTimeoutMs ?? DEFAULTS.upstreamTimeoutMs),
    upstreamConcurrency: numberEnv('GATEWAY_UPSTREAM_CONCURRENCY', fileConfig.upstreamConcurrency ?? DEFAULTS.upstreamConcurrency),
    enableGeminiRoutes: boolEnv(process.env.GATEWAY_ENABLE_GEMINI_ROUTES, fileConfig.enableGeminiRoutes ?? true),
    enableVertexRoutes: boolEnv(process.env.GATEWAY_ENABLE_VERTEX_ROUTES, fileConfig.enableVertexRoutes ?? true),
    enableVtxRoutes: boolEnv(process.env.GATEWAY_ENABLE_VTX_ROUTES, fileConfig.enableVtxRoutes ?? true),
    enableImageRoutes: boolEnv(process.env.GATEWAY_ENABLE_IMAGE_ROUTES, fileConfig.enableImageRoutes ?? true),
  };

  validateConfig(config);
  return config;
};

export const validateConfig = (config: GatewayConfig): void => {
  if (config.gatewayKeys.length === 0) throw new Error('GATEWAY_API_KEYS is required.');
  const serviceAccount = loadServiceAccountCredential(config.googleCredentialsFile);
  if (!config.googleProject && !serviceAccount?.project_id) {
    throw new Error('GOOGLE_VERTEX_PROJECT, GOOGLE_CLOUD_PROJECT, or service account project_id is required.');
  }
  if (!config.googleLocation) throw new Error('GOOGLE_VERTEX_LOCATION is required.');
};
