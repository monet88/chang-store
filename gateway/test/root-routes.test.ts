import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { testConfig } from './test-config.js';

const listen = async (server: Server): Promise<string> => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (typeof address === 'object' && address) resolve(`http://127.0.0.1:${address.port}`);
  });
});

describe('root route', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('returns public gateway endpoint metadata', async () => {
    const generateContent = vi.fn();
    server = createApp({ config: testConfig(), genAiFactory: () => ({ models: { generateContent } }) });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Chang Store Vertex Gateway');
    expect(body.endpoints).toEqual(expect.arrayContaining([
      'GET /gemini/v1beta/models',
      'POST /gemini/v1beta/models/{model}:generateContent',
      'POST /openai/v1/chat/completions',
      'POST /openai/v1/responses',
    ]));
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('returns readiness summary for pool mode without touching the model client', async () => {
    const generateContent = vi.fn();
    server = createApp({
      config: testConfig({
        runtimeMode: 'pool',
        vertexPoolSelection: 'round-robin',
        vertexPools: [
          {
            id: 'project-a',
            project: 'project-a',
            location: 'global',
            credentialsFile: null,
            enabled: true,
            weight: 1,
            label: 'Project A',
            modelAllowlist: [],
            modelExclusions: [],
          },
          {
            id: 'project-b',
            project: 'project-b',
            location: 'us-central1',
            credentialsFile: null,
            enabled: false,
            weight: 1,
            label: 'Project B',
            modelAllowlist: [],
            modelExclusions: [],
          },
        ],
        resolvedVertexTargets: [
          {
            id: 'project-a',
            project: 'project-a',
            location: 'global',
            credentialsFile: null,
            enabled: true,
            weight: 1,
            label: 'Project A',
            modelAllowlist: [],
            modelExclusions: [],
            source: 'pool',
          },
        ],
      }),
      genAiFactory: () => ({ models: { generateContent } }),
    });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/readyz`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.google).toEqual({
      mode: 'pool',
      apiVersion: 'v1',
      selection: 'round-robin',
      configuredTargets: 2,
      enabledTargets: 1,
      credentialFileTargets: 0,
    });
    expect(body.runtime).toEqual({
      mode: 'pool',
      selection: 'round-robin',
      configuredTargets: 2,
      enabledTargets: 1,
      healthyTargets: 1,
      cooldownTargets: 0,
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('returns detailed pool health only through the admin bearer route', async () => {
    const generateContent = vi.fn();
    server = createApp({
      config: testConfig({
        enableAdminRoutes: true,
        adminToken: 'admin-secret',
        runtimeMode: 'pool',
        vertexPools: [
          {
            id: 'project-a',
            project: 'project-a',
            location: 'global',
            credentialsFile: null,
            enabled: true,
            weight: 1,
            label: 'Project A',
            modelAllowlist: [],
            modelExclusions: [],
          },
        ],
        resolvedVertexTargets: [
          {
            id: 'project-a',
            project: 'project-a',
            location: 'global',
            credentialsFile: null,
            enabled: true,
            weight: 1,
            label: 'Project A',
            modelAllowlist: [],
            modelExclusions: [],
            source: 'pool',
          },
        ],
      }),
      genAiFactory: () => ({ models: { generateContent } }),
    });
    const baseUrl = await listen(server);

    const unauthorized = await fetch(`${baseUrl}/admin/api/health/pool`);
    expect(unauthorized.status).toBe(401);

    const authorized = await fetch(`${baseUrl}/admin/api/health/pool`, {
      headers: { authorization: 'Bearer admin-secret' },
    });
    const body = await authorized.json();

    expect(authorized.status).toBe(200);
    expect(body.runtime.active.targets).toEqual([
      expect.objectContaining({
        id: 'project-a',
        project: 'project-a',
        location: 'global',
        health: expect.objectContaining({
          status: 'healthy',
          success: 0,
          failure: 0,
        }),
      }),
    ]);
  });
});
