import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { GenAiRuntimeLike } from '../src/lib/genai-runtime.js';
import type { GenAiTargetHealth } from '../src/lib/genai-pool.js';
import { testConfig } from './test-config.js';

const listen = async (server: Server): Promise<string> => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (typeof address === 'object' && address) resolve(`http://127.0.0.1:${address.port}`);
  });
});

const createFakeRuntime = (): GenAiRuntimeLike => {
  const emptyHealth = (): GenAiTargetHealth => ({
    status: 'healthy',
    success: 0,
    failure: 0,
    recent: [],
    routeFamilyBuckets: {
      gemini: { success: 0, failure: 0 },
      vertex: { success: 0, failure: 0 },
      'openai-chat': { success: 0, failure: 0 },
      'openai-responses': { success: 0, failure: 0 },
      images: { success: 0, failure: 0 },
      unknown: { success: 0, failure: 0 },
    },
  });
  let snapshot = {
    mode: 'pool' as const,
    active: {
      version: 1,
      selection: 'round-robin' as const,
      targetCount: 0,
      healthyTargets: 0,
      cooldownTargets: 0,
      targets: [] as Array<{
        id: string;
        project: string;
        location: string;
        weight: number;
        health: GenAiTargetHealth;
      }>,
    },
  };
  return {
    client: { models: { generateContent: vi.fn(async () => ({})) } },
    getSnapshot: () => snapshot,
    reload: vi.fn((nextConfig) => {
      snapshot = {
        mode: nextConfig?.runtimeMode ?? 'pool',
        active: {
          version: snapshot.active.version + 1,
          selection: nextConfig?.vertexPoolSelection ?? 'round-robin',
          targetCount: nextConfig?.resolvedVertexTargets.length ?? 0,
          healthyTargets: nextConfig?.resolvedVertexTargets.length ?? 0,
          cooldownTargets: 0,
          targets: (nextConfig?.resolvedVertexTargets ?? []).map((target) => ({
            id: target.id,
            project: target.project,
            location: target.location,
            weight: target.weight,
            health: emptyHealth(),
          })),
        },
      };
      return snapshot;
    }),
    probeTarget: vi.fn(async (target) => ({ targetId: target.id, ok: true })),
  };
};

describe('admin routes', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('returns 404 when admin routes are disabled', async () => {
    server = createApp({ config: testConfig() });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/admin/api/health`);
    expect(response.status).toBe(404);
  });

  it('does not apply public CORS headers to admin routes', async () => {
    server = createApp({
      config: testConfig({
        enableAdminRoutes: true,
        adminToken: 'admin-secret',
        corsOrigins: ['https://example.test'],
      }),
      runtimeFactory: () => createFakeRuntime(),
    });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/admin/api/health`, {
      headers: { authorization: 'Bearer admin-secret', origin: 'https://example.test' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('supports file-store import, list, detail, patch, test, model update, reload, and delete', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-admin-'));
    const runtime = createFakeRuntime();
    server = createApp({
      config: testConfig({
        enableAdminRoutes: true,
        adminToken: 'admin-secret',
        adminAllowMutations: true,
        adminStoreMode: 'file-store',
        adminFileStoreDir: dir,
        runtimeMode: 'pool',
        vertexPools: [],
        resolvedVertexTargets: [],
      }),
      runtimeFactory: () => runtime,
    });
    const baseUrl = await listen(server);
    const headers = {
      authorization: 'Bearer admin-secret',
      'content-type': 'application/json',
    };

    const imported = await fetch(`${baseUrl}/admin/api/vertex-credentials/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        project: 'project-a',
        location: 'global',
        label: 'Project A',
        credential: {
          type: 'service_account',
          project_id: 'project-a',
          client_email: 'svc@example.test',
          private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        },
      }),
    });
    const importedBody = await imported.json();

    expect(imported.status).toBe(200);
    expect(importedBody.credential.private_key).toBeUndefined();
    expect(importedBody.credential.email).toBe('svc@example.test');

    const list = await fetch(`${baseUrl}/admin/api/vertex-credentials`, {
      headers: { authorization: 'Bearer admin-secret' },
    });
    const listBody = await list.json();
    expect(listBody.vertexPools).toHaveLength(1);
    const id = listBody.vertexPools[0].id as string;

    const detail = await fetch(`${baseUrl}/admin/api/vertex-credentials/${id}`, {
      headers: { authorization: 'Bearer admin-secret' },
    });
    expect(detail.status).toBe(200);

    const patch = await fetch(`${baseUrl}/admin/api/vertex-credentials/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ label: 'Updated Project A', weight: 3 }),
    });
    const patchBody = await patch.json();
    expect(patchBody.credential.label).toBe('Updated Project A');
    expect(patchBody.credential.weight).toBe(3);

    const testResponse = await fetch(`${baseUrl}/admin/api/vertex-credentials/${id}/test`, {
      method: 'POST',
      headers: { authorization: 'Bearer admin-secret' },
    });
    expect(testResponse.status).toBe(200);
    expect(runtime.probeTarget).toHaveBeenCalled();

    const modelPut = await fetch(`${baseUrl}/admin/api/models/gemini`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        defaultModel: 'gemini-2.5-flash',
        aliases: { fast: 'gemini-2.5-flash' },
        allowlist: ['gemini-2.5-flash'],
        disabled: [],
      }),
    });
    expect(modelPut.status).toBe(200);

    const modelGet = await fetch(`${baseUrl}/admin/api/models?provider=gemini`, {
      headers: { authorization: 'Bearer admin-secret' },
    });
    const modelGetBody = await modelGet.json();
    expect(modelGetBody.defaultModel).toBe('gemini-2.5-flash');

    const reload = await fetch(`${baseUrl}/admin/api/runtime/reload`, {
      method: 'POST',
      headers: { authorization: 'Bearer admin-secret' },
    });
    expect(reload.status).toBe(200);
    expect(runtime.reload).toHaveBeenCalled();

    const remove = await fetch(`${baseUrl}/admin/api/vertex-credentials/${id}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer admin-secret' },
    });
    const removeBody = await remove.json();
    expect(removeBody.remaining).toBe(0);
  });

  it('rolls back admin store changes when runtime reload fails', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-admin-'));
    const runtime = createFakeRuntime();
    runtime.reload = vi.fn(() => {
      throw new Error('reload failed');
    });
    server = createApp({
      config: testConfig({
        enableAdminRoutes: true,
        adminToken: 'admin-secret',
        adminAllowMutations: true,
        adminStoreMode: 'file-store',
        adminFileStoreDir: dir,
        runtimeMode: 'pool',
        vertexPools: [],
        resolvedVertexTargets: [],
      }),
      runtimeFactory: () => runtime,
    });
    const baseUrl = await listen(server);
    const headers = {
      authorization: 'Bearer admin-secret',
      'content-type': 'application/json',
    };

    const failedImport = await fetch(`${baseUrl}/admin/api/vertex-credentials/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        project: 'project-a',
        location: 'global',
        credential: {
          type: 'service_account',
          project_id: 'project-a',
          client_email: 'svc@example.test',
          private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        },
      }),
    });
    expect(failedImport.status).toBe(500);

    const list = await fetch(`${baseUrl}/admin/api/vertex-credentials`, {
      headers: { authorization: 'Bearer admin-secret' },
    });
    const listBody = await list.json();
    expect(listBody.vertexPools).toHaveLength(0);
  });

  it('serves the admin dashboard shell from the gateway', async () => {
    server = createApp({
      config: testConfig({
        enableAdminRoutes: true,
        adminToken: 'admin-secret',
      }),
      runtimeFactory: () => createFakeRuntime(),
    });
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/admin`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Credential Pool Operations Console');
    expect(html).toContain('id="token-input"');
    expect(html).toContain('id="credential-list"');
  });
});
