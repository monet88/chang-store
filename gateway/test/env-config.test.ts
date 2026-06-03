import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
});

describe('gateway config file', () => {
  it('loads config from GATEWAY_CONFIG_FILE when env vars are absent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-config-'));
    const configPath = path.join(dir, 'config.yaml');
    fs.writeFileSync(configPath, [
      'port: 19087',
      'gatewayKeys:',
      '  - monet-4292',
      'corsOrigins:',
      '  - http://localhost:3000',
      'googleProject: project-b82b6a5a-13c8-42e4-a56',
      'googleCredentialsFile: null',
      'googleLocation: global',
      'enableGeminiRoutes: true',
      'enableVertexRoutes: true',
      'enableVtxRoutes: true',
      'enableImageRoutes: true',
    ].join('\n'));

    delete process.env.PORT;
    delete process.env.GATEWAY_API_KEYS;
    delete process.env.GATEWAY_CORS_ORIGINS;
    delete process.env.GOOGLE_VERTEX_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_VERTEX_LOCATION;
    process.env.GATEWAY_CONFIG_FILE = configPath;

    const config = loadConfig();
    expect(config.port).toBe(19087);
    expect(config.gatewayKeys).toEqual(['monet-4292']);
    expect(config.corsOrigins).toEqual(['http://localhost:3000']);
    expect(config.googleProject).toBe('project-b82b6a5a-13c8-42e4-a56');
    expect(config.googleCredentialsFile).toBeNull();
    expect(config.googleLocation).toBe('global');
  });

  it('lets env vars override file config', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-config-'));
    const configPath = path.join(dir, 'config.yaml');
    fs.writeFileSync(configPath, [
      'gatewayKeys:',
      '  - from-file',
      'googleProject: from-file-project',
      'googleCredentialsFile: null',
      'googleLocation: global',
    ].join('\n'));

    process.env.GATEWAY_CONFIG_FILE = configPath;
    process.env.GATEWAY_API_KEYS = 'from-env';
    process.env.GOOGLE_VERTEX_PROJECT = 'from-env-project';
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_VERTEX_LOCATION;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;

    const config = loadConfig();
    expect(config.gatewayKeys).toEqual(['from-env']);
    expect(config.googleProject).toBe('from-env-project');
  });

  it('keeps hash characters inside quoted YAML scalar values', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-config-'));
    const configPath = path.join(dir, 'config.yaml');
    fs.writeFileSync(configPath, [
      'gatewayKeys:',
      '  - "monet#4292"',
      'googleProject: "project#hash"',
      'googleCredentialsFile: null',
      'googleLocation: global',
    ].join('\n'));

    process.env.GATEWAY_CONFIG_FILE = configPath;
    delete process.env.GATEWAY_API_KEYS;
    delete process.env.GOOGLE_VERTEX_PROJECT;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_VERTEX_LOCATION;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;

    const config = loadConfig();
    expect(config.gatewayKeys).toEqual(['monet#4292']);
    expect(config.googleProject).toBe('project#hash');
  });

  it('loads JSON config files without YAML parsing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-config-'));
    const configPath = path.join(dir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      gatewayKeys: ['json#key'],
      googleProject: 'json-project',
      googleCredentialsFile: null,
      googleLocation: 'global',
    }));

    process.env.GATEWAY_CONFIG_FILE = configPath;
    delete process.env.GATEWAY_API_KEYS;
    delete process.env.GOOGLE_VERTEX_PROJECT;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_VERTEX_LOCATION;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;

    const config = loadConfig();
    expect(config.gatewayKeys).toEqual(['json#key']);
    expect(config.googleProject).toBe('json-project');
  });
});
