import { describe, expect, it, vi } from 'vitest';
import { createGenAiRuntime } from '../src/lib/genai-runtime.js';
import type { GenAiTargetClientFactory } from '../src/lib/google-genai-client.js';
import { ImageWorkloads } from '../src/workloads/image-workloads.js';
import { testConfig } from './test-config.js';

const createFactory = (calls: string[], streamEvents?: string[]): GenAiTargetClientFactory => (
  _config,
  target,
) => ({
  models: {
    generateContent: vi.fn(async () => {
      calls.push(target.id);
      return { targetId: target.id };
    }),
    generateContentStream: vi.fn(async () => ({
      async *[Symbol.asyncIterator]() {
        calls.push(`stream:${target.id}`);
        if (streamEvents) {
          for (const event of streamEvents) {
            yield { targetId: target.id, event };
          }
        }
      },
    })),
  },
});

describe('GenAI runtime pool', () => {
  it('rotates across targets with round-robin selection', async () => {
    const calls: string[] = [];
    const runtime = createGenAiRuntime(testConfig({
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
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project B',
          modelAllowlist: [],
          modelExclusions: [],
        },
        {
          id: 'project-c',
          project: 'project-c',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project C',
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
        {
          id: 'project-b',
          project: 'project-b',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project B',
          modelAllowlist: [],
          modelExclusions: [],
          source: 'pool',
        },
        {
          id: 'project-c',
          project: 'project-c',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project C',
          modelAllowlist: [],
          modelExclusions: [],
          source: 'pool',
        },
      ],
    }), createFactory(calls));

    await runtime.client.models.generateContent({ model: 'gemini-2.5-flash' });
    await runtime.client.models.generateContent({ model: 'gemini-2.5-flash' });
    await runtime.client.models.generateContent({ model: 'gemini-2.5-flash' });

    expect(calls).toEqual(['project-a', 'project-b', 'project-c']);
  });

  it('uses weighted round-robin for uneven target weights', async () => {
    const calls: string[] = [];
    const runtime = createGenAiRuntime(testConfig({
      runtimeMode: 'pool',
      vertexPoolSelection: 'weighted-round-robin',
      vertexPools: [
        {
          id: 'project-a',
          project: 'project-a',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 3,
          label: 'Project A',
          modelAllowlist: [],
          modelExclusions: [],
        },
        {
          id: 'project-b',
          project: 'project-b',
          location: 'global',
          credentialsFile: null,
          enabled: true,
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
          weight: 3,
          label: 'Project A',
          modelAllowlist: [],
          modelExclusions: [],
          source: 'pool',
        },
        {
          id: 'project-b',
          project: 'project-b',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project B',
          modelAllowlist: [],
          modelExclusions: [],
          source: 'pool',
        },
      ],
    }), createFactory(calls));

    for (let index = 0; index < 8; index += 1) {
      await runtime.client.models.generateContent({ model: 'gemini-2.5-flash' });
    }

    expect(calls.filter((id) => id === 'project-a')).toHaveLength(6);
    expect(calls.filter((id) => id === 'project-b')).toHaveLength(2);
  });

  it('keeps a stable proxy across reload and sends future traffic to new targets', async () => {
    const calls: string[] = [];
    const runtime = createGenAiRuntime(testConfig({
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
    }), createFactory(calls));

    const stableClient = runtime.client;
    await stableClient.models.generateContent({ model: 'gemini-2.5-flash' });
    runtime.reload(testConfig({
      runtimeMode: 'pool',
      vertexPoolSelection: 'round-robin',
      vertexPools: [
        {
          id: 'project-b',
          project: 'project-b',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project B',
          modelAllowlist: [],
          modelExclusions: [],
        },
      ],
      resolvedVertexTargets: [
        {
          id: 'project-b',
          project: 'project-b',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project B',
          modelAllowlist: [],
          modelExclusions: [],
          source: 'pool',
        },
      ],
    }));
    await stableClient.models.generateContent({ model: 'gemini-2.5-flash' });

    expect(calls).toEqual(['project-a', 'project-b']);
  });

  it('keeps the previous snapshot active when reload build fails', async () => {
    const calls: string[] = [];
    const factory: GenAiTargetClientFactory = (_config, target) => {
      if (target.id === 'project-b') {
        throw new Error('bad target');
      }
      return {
        models: {
          generateContent: vi.fn(async () => {
            calls.push(target.id);
            return { targetId: target.id };
          }),
        },
      };
    };
    const runtime = createGenAiRuntime(testConfig({
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
    }), factory);

    expect(() => runtime.reload(testConfig({
      runtimeMode: 'pool',
      vertexPools: [
        {
          id: 'project-b',
          project: 'project-b',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project B',
          modelAllowlist: [],
          modelExclusions: [],
        },
      ],
      resolvedVertexTargets: [
        {
          id: 'project-b',
          project: 'project-b',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project B',
          modelAllowlist: [],
          modelExclusions: [],
          source: 'pool',
        },
      ],
    }))).toThrow(/bad target/);

    await runtime.client.models.generateContent({ model: 'gemini-2.5-flash' });
    expect(calls).toEqual(['project-a']);
  });

  it('pins the snapshot until a streaming iterator completes', async () => {
    const calls: string[] = [];
    const runtime = createGenAiRuntime(testConfig({
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
    }), createFactory(calls, ['chunk-1', 'chunk-2']));

    const stream = await runtime.client.models.generateContentStream?.({ model: 'gemini-2.5-flash' });
    expect(runtime.getSnapshot().active.targetCount).toBe(1);
    const activeSnapshot = (runtime as unknown as { activeSnapshot: { refCount: number } }).activeSnapshot;

    expect(activeSnapshot.refCount).toBe(1);
    const chunks: string[] = [];
    for await (const chunk of stream ?? []) {
      chunks.push(String(chunk.event));
    }
    expect(chunks).toEqual(['chunk-1', 'chunk-2']);
    expect(activeSnapshot.refCount).toBe(0);
    expect(calls).toEqual(['stream:project-a']);
  });

  it('routes custom image workloads through the same pool seam', async () => {
    const calls: string[] = [];
    const runtime = createGenAiRuntime(testConfig({
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
          location: 'global',
          credentialsFile: null,
          enabled: true,
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
        {
          id: 'project-b',
          project: 'project-b',
          location: 'global',
          credentialsFile: null,
          enabled: true,
          weight: 1,
          label: 'Project B',
          modelAllowlist: [],
          modelExclusions: [],
          source: 'pool',
        },
      ],
    }), (_config, target) => ({
      models: {
        generateContent: vi.fn(async () => {
          calls.push(target.id);
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: 'ZmFrZQ==',
                      },
                    },
                  ],
                },
              },
            ],
          };
        }),
      },
    }));
    const workloads = new ImageWorkloads(runtime.client, testConfig());

    const response = await workloads.generate({
      prompt: 'Generate outfit',
      model: 'gemini-3.1-flash-image',
      numberOfImages: 2,
    });

    expect(response.images).toHaveLength(2);
    expect(calls).toEqual(['project-a', 'project-b']);
  });
});
