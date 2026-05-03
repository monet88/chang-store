import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeJob, failJob, partialJob, reconcileJobOutputs } from '../../server/adapters/base-adapter';
import type { DB } from '../../server/db';
import { CSRF_HEADER_NAME, generateCsrfToken } from '../../api/_lib/csrf';

function createJobRow(jobId: string, status: 'queued' | 'running' | 'completed' | 'failed' | 'partial' = 'running') {
  return {
    id: jobId,
    user_id: 'user-1',
    feature: 'lookbook',
    status,
    idempotency_key: 'idem-1',
    input_payload_json: {},
    workflow_run_id: null,
    progress_total: 1,
    progress_done: status === 'completed' || status === 'partial' ? 1 : 0,
    created_at: new Date().toISOString(),
    started_at: status === 'queued' ? null : new Date().toISOString(),
    completed_at: status === 'completed' || status === 'failed' || status === 'partial' ? new Date().toISOString() : null,
    error_code: status === 'failed' ? 'EXECUTION_FAILED' : null,
    error_message: status === 'failed' ? 'Already failed' : null,
  };
}

function createRunningJobRow(jobId: string) {
  return createJobRow(jobId);
}

describe('job finalization persistence', () => {
  function createMockDB(options: {
    jobQuery: DB['query'];
    txQuery: DB['query'];
  }): DB {
    return {
      query: options.jobQuery,
      withTransaction: (async <T>(fn: (tx: DB) => Promise<T>): Promise<T> => {
        const txDB: DB = {
          query: options.txQuery,
          withTransaction: vi.fn() as unknown as DB['withTransaction'],
        };
        return fn(txDB);
      }) as DB['withTransaction'],
    };
  }

  it('persists completed assets, status, and event within a transaction', async () => {
    const jobQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [createRunningJobRow('job-complete')] });
    const txQuery = vi.fn()
      .mockResolvedValueOnce({ // createJobAsset
        rows: [{
          id: 'asset-1',
          job_id: 'job-complete',
          kind: 'output',
          blob_path: 'outputs/job-complete/0.png',
          mime_type: 'image/png',
          created_at: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // updateJobStatus
      .mockResolvedValueOnce({ rows: [{ id: 'ev-1' }] }); // createJobEvent

    const db = createMockDB({ jobQuery, txQuery });

    const result = await completeJob(db, 'job-complete', [
      { blobPath: 'outputs/job-complete/0.png', mimeType: 'image/png' },
    ], 'trace-complete');

    expect(result).toHaveLength(1);
    expect(result[0].blob_path).toBe('outputs/job-complete/0.png');
    expect(txQuery.mock.calls[1][0]).toContain('AND status =');
  });

  it('rejects completed finalization when the job status changes after the initial read', async () => {
    const jobQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [createRunningJobRow('job-complete-race')] });
    const txQuery = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          id: 'asset-1',
          job_id: 'job-complete-race',
          kind: 'output',
          blob_path: 'outputs/job-complete-race/0.png',
          mime_type: 'image/png',
          created_at: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const db = createMockDB({ jobQuery, txQuery });

    await expect(completeJob(db, 'job-complete-race', [
      { blobPath: 'outputs/job-complete-race/0.png', mimeType: 'image/png' },
    ], 'trace-complete-race')).rejects.toThrow('Cannot transition job job-complete-race from running to completed');

    expect(txQuery).toHaveBeenCalledTimes(2);
  });

  it('fails closed when a conditional status update does not report rowCount', async () => {
    const { updateJobStatus } = await import('../../server/db');
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const db: DB = { query, withTransaction: vi.fn() };

    await expect(updateJobStatus(
      db,
      'job-missing-row-count',
      'completed',
      undefined,
      undefined,
      'running',
    )).rejects.toThrow('Cannot transition job job-missing-row-count from running to completed');
  });

  it('does not create a failed event when the failed transition loses the status race', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [createRunningJobRow('job-fail-race')] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const db: DB = { query, withTransaction: vi.fn() };

    await expect(failJob(
      db,
      'job-fail-race',
      'EXECUTION_FAILED',
      'db finalize failed',
      'trace-fail-race',
    )).rejects.toThrow('Cannot transition job job-fail-race from running to failed');

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('persists partial assets, status, and event within a transaction', async () => {
    const jobQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [createRunningJobRow('job-partial')] });
    const txQuery = vi.fn()
      .mockResolvedValueOnce({ // createJobAsset
        rows: [{
          id: 'asset-1',
          job_id: 'job-partial',
          kind: 'output',
          blob_path: 'outputs/job-partial/0.png',
          mime_type: 'image/png',
          created_at: new Date().toISOString(),
        }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // updateJobStatus
      .mockResolvedValueOnce({ rows: [{ id: 'ev-1' }] }); // createJobEvent

    const db = createMockDB({ jobQuery, txQuery });

    const result = await partialJob(
      db,
      'job-partial',
      [{ blobPath: 'outputs/job-partial/0.png', mimeType: 'image/png' }],
      'PARTIAL_FAILURE',
      'Some items failed',
      'trace-partial',
    );

    expect(result).toHaveLength(1);
    expect(result[0].blob_path).toBe('outputs/job-partial/0.png');
  });
});

describe('workflow step events', () => {
  it('returns successful step results when step_completed event persistence fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const createJobEvent = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('event write failed'));

    vi.resetModules();
    vi.doMock('../../server/db', async () => {
      const actual = await vi.importActual<typeof import('../../server/db')>('../../server/db');
      return {
        ...actual,
        createJobEvent,
      };
    });

    const { withErrorHandling } = await import('../../workflows/helpers');
    const result = await withErrorHandling(
      { db: {} as DB, blob: {} as never, traceId: 'trace-step' },
      'job-step',
      'gemini_execute',
      async () => 'ok',
    );

    expect(result).toBe('ok');
    expect(consoleError).toHaveBeenCalledWith(
      '[WORKFLOW] Failed to persist step_completed event:',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});

describe('runFeatureJob cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('validates persisted payload before mapping adapter input', async () => {
    const updateJobStatus = vi.fn().mockResolvedValue(undefined);
    const completeJobMock = vi.fn().mockResolvedValue([]);
    const failJobMock = vi.fn().mockResolvedValue(undefined);
    const storeFile = vi.fn().mockResolvedValue(undefined);
    const validate = vi.fn(() => ({ images: ['validated'] }));
    const mapInput = vi.fn(() => ({ images: ['mapped'] }));
    const executeStep = vi.fn().mockResolvedValue({
      results: [{ base64: Buffer.from('image').toString('base64'), mimeType: 'image/png' }],
    });

    vi.doMock('../../server/db', async () => {
      const actual = await vi.importActual<typeof import('../../server/db')>('../../server/db');
      return {
        ...actual,
        updateJobStatus,
      };
    });
    vi.doMock('../../workflows/helpers', () => ({
      createWorkflowContext: vi.fn(() => ({
        db: {},
        traceId: 'trace-validate',
        blob: { storeFile, deleteBlob: vi.fn() },
      })),
      withErrorHandling: vi.fn(async (_ctx, _jobId, _step, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock('../../server/jobs', () => ({
      transitionStatus: vi.fn(() => ({ status: 'running' })),
    }));
    vi.doMock('../../server/adapters/base-adapter', () => ({
      completeJob: completeJobMock,
      partialJob: vi.fn(),
      failJob: failJobMock,
    }));
    vi.doMock('../../workflows/canary', () => ({
      runCanary: vi.fn(),
    }));

    const { runFeatureJob } = await import('../../workflows/feature-runner');
    await runFeatureJob(
      {} as DB,
      createRunningJobRow('job-validate') as never,
      {
        feature: 'lookbook',
        validate,
        mapInput,
        mapOutput: vi.fn(),
      },
      executeStep,
      'trace-validate',
    );

    expect(validate).toHaveBeenCalledWith({});
    expect(mapInput).toHaveBeenCalledWith({ images: ['validated'] });
    expect(executeStep).toHaveBeenCalledWith(expect.anything(), { images: ['mapped'] }, 'lookbook');
  });

  it('returns the current job state when the running transition loses a race', async () => {
    const updateJobStatus = vi.fn().mockRejectedValue(new Error('Cannot transition job job-start-race from queued to running'));
    const getJobById = vi.fn().mockResolvedValue(createJobRow('job-start-race', 'running'));
    const completeJobMock = vi.fn().mockResolvedValue([]);
    const failJobMock = vi.fn().mockResolvedValue(undefined);
    const executeStep = vi.fn();

    vi.doMock('../../server/db', async () => {
      const actual = await vi.importActual<typeof import('../../server/db')>('../../server/db');
      return {
        ...actual,
        getJobById,
        updateJobStatus,
      };
    });
    vi.doMock('../../workflows/helpers', () => ({
      createWorkflowContext: vi.fn(() => ({
        db: {},
        traceId: 'trace-start-race',
        blob: { storeFile: vi.fn(), deleteBlob: vi.fn() },
      })),
      withErrorHandling: vi.fn(async (_ctx, _jobId, _step, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock('../../server/jobs', () => ({
      transitionStatus: vi.fn(() => ({ status: 'running' })),
    }));
    vi.doMock('../../server/adapters/base-adapter', () => ({
      completeJob: completeJobMock,
      partialJob: vi.fn(),
      failJob: failJobMock,
    }));
    vi.doMock('../../workflows/canary', () => ({
      runCanary: vi.fn(),
    }));

    const { runFeatureJob } = await import('../../workflows/feature-runner');
    const result = await runFeatureJob(
      {} as DB,
      createJobRow('job-start-race', 'queued') as never,
      {
        feature: 'lookbook',
        validate: vi.fn(),
        mapInput: vi.fn(),
        mapOutput: vi.fn(),
      },
      executeStep,
      'trace-start-race',
    );

    expect(updateJobStatus).toHaveBeenCalledWith(expect.anything(), 'job-start-race', 'running', undefined, undefined, 'queued');
    expect(result).toEqual({ status: 'running' });
    expect(executeStep).not.toHaveBeenCalled();
    expect(completeJobMock).not.toHaveBeenCalled();
    expect(failJobMock).not.toHaveBeenCalled();
  });

  it('deletes uploaded blobs when complete finalization fails', async () => {
    const updateJobStatus = vi.fn().mockResolvedValue(undefined);
    const completeJobMock = vi.fn().mockRejectedValue(new Error('db finalize failed'));
    const partialJobMock = vi.fn().mockResolvedValue([]);
    const failJobMock = vi.fn().mockResolvedValue(undefined);
    const storeFile = vi.fn().mockResolvedValue(undefined);
    const deleteBlob = vi.fn().mockResolvedValue(undefined);

    vi.doMock('../../server/db', async () => {
      const actual = await vi.importActual<typeof import('../../server/db')>('../../server/db');
      return {
        ...actual,
        updateJobStatus,
      };
    });
    vi.doMock('../../workflows/helpers', () => ({
      createWorkflowContext: vi.fn(() => ({
        db: {},
        traceId: 'trace-1',
        blob: { storeFile, deleteBlob },
      })),
      withErrorHandling: vi.fn(async (_ctx, _jobId, _step, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock('../../server/jobs', () => ({
      transitionStatus: vi.fn(() => ({ status: 'running' })),
    }));
    vi.doMock('../../server/adapters/base-adapter', () => ({
      completeJob: completeJobMock,
      partialJob: partialJobMock,
      failJob: failJobMock,
    }));
    vi.doMock('../../workflows/canary', () => ({
      runCanary: vi.fn(),
    }));

    const { runFeatureJob } = await import('../../workflows/feature-runner');

    const result = await runFeatureJob(
      {} as DB,
      createRunningJobRow('job-runner') as never,
      {
        feature: 'lookbook',
        validate: vi.fn(),
        mapInput: vi.fn(() => ({ images: ['x'] })),
        mapOutput: vi.fn(),
      },
      vi.fn().mockResolvedValue({
        results: [{ base64: Buffer.from('image').toString('base64'), mimeType: 'image/png' }],
      }),
      'trace-1',
    );

    expect(completeJobMock).toHaveBeenCalledWith(
      expect.anything(),
      'job-runner',
      [{ blobPath: 'outputs/job-runner/0.png', mimeType: 'image/png' }],
      'trace-1',
    );
    expect(deleteBlob).toHaveBeenCalledWith('outputs/job-runner/0.png');
    expect(failJobMock).toHaveBeenCalledWith(expect.anything(), 'job-runner', 'EXECUTION_FAILED', 'db finalize failed', 'trace-1', undefined);
    expect(result).toEqual({
      status: 'failed',
      errorCode: 'EXECUTION_FAILED',
      errorMessage: 'db finalize failed',
    });
  });

  it('returns terminal job state when failure persistence loses a race after cleanup', async () => {
    const updateJobStatus = vi.fn().mockResolvedValue(undefined);
    const getJobById = vi.fn().mockResolvedValue(createJobRow('job-terminal-race', 'failed'));
    const completeJobMock = vi.fn().mockRejectedValue(new Error('db finalize failed'));
    const failJobMock = vi.fn().mockRejectedValue(new Error('Cannot transition job job-terminal-race from failed to failed'));
    const storeFile = vi.fn().mockResolvedValue(undefined);
    const deleteBlob = vi.fn().mockResolvedValue(undefined);

    vi.doMock('../../server/db', async () => {
      const actual = await vi.importActual<typeof import('../../server/db')>('../../server/db');
      return {
        ...actual,
        getJobById,
        updateJobStatus,
      };
    });
    vi.doMock('../../workflows/helpers', () => ({
      createWorkflowContext: vi.fn(() => ({
        db: {},
        traceId: 'trace-terminal-race',
        blob: { storeFile, deleteBlob },
      })),
      withErrorHandling: vi.fn(async (_ctx, _jobId, _step, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock('../../server/jobs', () => ({
      transitionStatus: vi.fn(() => ({ status: 'running' })),
    }));
    vi.doMock('../../server/adapters/base-adapter', () => ({
      completeJob: completeJobMock,
      partialJob: vi.fn(),
      failJob: failJobMock,
    }));
    vi.doMock('../../workflows/canary', () => ({
      runCanary: vi.fn(),
    }));

    const { runFeatureJob } = await import('../../workflows/feature-runner');
    const result = await runFeatureJob(
      {} as DB,
      createJobRow('job-terminal-race') as never,
      {
        feature: 'lookbook',
        validate: vi.fn(),
        mapInput: vi.fn(() => ({ images: ['x'] })),
        mapOutput: vi.fn(),
      },
      vi.fn().mockResolvedValue({
        results: [{ base64: Buffer.from('image').toString('base64'), mimeType: 'image/png' }],
      }),
      'trace-terminal-race',
    );

    expect(deleteBlob).toHaveBeenCalledWith('outputs/job-terminal-race/0.png');
    expect(failJobMock).toHaveBeenCalledWith(expect.anything(), 'job-terminal-race', 'EXECUTION_FAILED', 'db finalize failed', 'trace-terminal-race', undefined);
    expect(result).toEqual({
      status: 'failed',
      errorCode: 'EXECUTION_FAILED',
      errorMessage: 'Already failed',
    });
  });

  it('persists cleanup failure evidence while keeping original finalize error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const updateJobStatus = vi.fn().mockResolvedValue(undefined);
    const completeJobMock = vi.fn().mockResolvedValue([]);
    const partialJobMock = vi.fn().mockRejectedValue(new Error('partial finalize failed'));
    const failJobMock = vi.fn().mockResolvedValue(undefined);
    const storeFile = vi.fn().mockResolvedValue(undefined);
    const deleteBlob = vi.fn()
      .mockRejectedValueOnce(new Error('delete failed'))
      .mockResolvedValueOnce(undefined);

    vi.doMock('../../server/db', async () => {
      const actual = await vi.importActual<typeof import('../../server/db')>('../../server/db');
      return {
        ...actual,
        updateJobStatus,
      };
    });
    vi.doMock('../../workflows/helpers', () => ({
      createWorkflowContext: vi.fn(() => ({
        db: {},
        traceId: 'trace-2',
        blob: { storeFile, deleteBlob },
      })),
      withErrorHandling: vi.fn(async (_ctx, _jobId, _step, fn: () => Promise<unknown>) => fn()),
    }));
    vi.doMock('../../server/jobs', () => ({
      transitionStatus: vi.fn(() => ({ status: 'running' })),
    }));
    vi.doMock('../../server/adapters/base-adapter', () => ({
      completeJob: completeJobMock,
      partialJob: partialJobMock,
      failJob: failJobMock,
    }));
    vi.doMock('../../workflows/canary', () => ({
      runCanary: vi.fn(),
    }));

    const { runFeatureJob } = await import('../../workflows/feature-runner');

    const result = await runFeatureJob(
      {} as DB,
      createRunningJobRow('job-partial-cleanup') as never,
      {
        feature: 'lookbook',
        validate: vi.fn(),
        mapInput: vi.fn(() => ({ images: ['x', 'y', 'z'] })),
        mapOutput: vi.fn(),
      },
      vi.fn().mockResolvedValue({
        results: [
          { base64: Buffer.from('image-1').toString('base64'), mimeType: 'image/png' },
          { error: 'failed' },
          { base64: Buffer.from('image-2').toString('base64'), mimeType: 'image/png' },
        ],
      }),
      'trace-2',
    );

    expect(partialJobMock).toHaveBeenCalledWith(
      expect.anything(),
      'job-partial-cleanup',
      [
        { blobPath: 'outputs/job-partial-cleanup/0.png', mimeType: 'image/png' },
        { blobPath: 'outputs/job-partial-cleanup/2.png', mimeType: 'image/png' },
      ],
      'PARTIAL_FAILURE',
      'Some items failed',
      'trace-2',
    );
    expect(deleteBlob).toHaveBeenCalledTimes(2);
    expect(deleteBlob).toHaveBeenNthCalledWith(1, 'outputs/job-partial-cleanup/0.png');
    expect(deleteBlob).toHaveBeenNthCalledWith(2, 'outputs/job-partial-cleanup/2.png');
    expect(consoleError).toHaveBeenCalledWith(
      '[RUNNER] Failed to clean up blob outputs/job-partial-cleanup/0.png:',
      expect.any(Error),
    );
    expect(failJobMock).toHaveBeenCalledWith(
      expect.anything(),
      'job-partial-cleanup',
      'EXECUTION_FAILED',
      'partial finalize failed',
      'trace-2',
      {
        cleanupFailures: [
          {
            blobPath: 'outputs/job-partial-cleanup/0.png',
            errorMessage: 'delete failed',
          },
        ],
      },
    );
    expect(result).toEqual({
      status: 'failed',
      errorCode: 'EXECUTION_FAILED',
      errorMessage: 'partial finalize failed',
    });
  });
});

describe('reconcileJobOutputs', () => {
  it('reports orphan output blobs for one job without deleting by default', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [createRunningJobRow('job-reconcile')] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'asset-1',
            job_id: 'job-reconcile',
            kind: 'output',
            blob_path: 'outputs/job-reconcile/0.png',
            mime_type: 'image/png',
            created_at: new Date().toISOString(),
          },
        ],
      });
    const blob = {
      listBlobs: vi.fn().mockResolvedValue([
        { path: 'outputs/job-reconcile/0.png', url: 'https://blob/0' },
        { path: 'outputs/job-reconcile/1.png', url: 'https://blob/1' },
      ]),
      deleteBlob: vi.fn().mockResolvedValue(undefined),
    };
    const db: DB = { query, withTransaction: vi.fn() };

    const result = await reconcileJobOutputs(db, 'job-reconcile', { blob });

    expect(blob.listBlobs).toHaveBeenCalledWith('outputs/job-reconcile/');
    expect(blob.deleteBlob).not.toHaveBeenCalled();
    expect(result).toEqual({
      jobId: 'job-reconcile',
      outputPrefix: 'outputs/job-reconcile/',
      persistedOutputPaths: ['outputs/job-reconcile/0.png'],
      blobOutputPaths: ['outputs/job-reconcile/0.png', 'outputs/job-reconcile/1.png'],
      orphanedOutputPaths: ['outputs/job-reconcile/1.png'],
      deletedOutputPaths: [],
      deleteFailures: [],
    });
  });

  it('deletes orphan outputs when requested and reports delete failures', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [createRunningJobRow('job-reconcile-delete')] })
      .mockResolvedValueOnce({ rows: [] });
    const blob = {
      listBlobs: vi.fn().mockResolvedValue([
        { path: 'outputs/job-reconcile-delete/0.png', url: 'https://blob/0' },
        { path: 'outputs/job-reconcile-delete/1.png', url: 'https://blob/1' },
      ]),
      deleteBlob: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('blob delete failed')),
    };
    const db: DB = { query, withTransaction: vi.fn() };

    const result = await reconcileJobOutputs(db, 'job-reconcile-delete', {
      blob,
      deleteOrphans: true,
    });

    expect(blob.deleteBlob).toHaveBeenNthCalledWith(1, 'outputs/job-reconcile-delete/0.png');
    expect(blob.deleteBlob).toHaveBeenNthCalledWith(2, 'outputs/job-reconcile-delete/1.png');
    expect(result.deletedOutputPaths).toEqual(['outputs/job-reconcile-delete/0.png']);
    expect(result.deleteFailures).toEqual([
      {
        blobPath: 'outputs/job-reconcile-delete/1.png',
        errorMessage: 'blob delete failed',
      },
    ]);
  });
});

describe('job detail route reconcile', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('runs manual reconciliation for a completed authenticated job owner', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const getJobByIdMock = vi.fn()
      .mockResolvedValueOnce({
        ...createRunningJobRow('job-route'),
        status: 'completed',
        progress_done: 1,
        completed_at: new Date().toISOString(),
      });
    const getJobEventsMock = vi.fn();
    const reconcileJobOutputsMock = vi.fn().mockResolvedValue({
      jobId: 'job-route',
      outputPrefix: 'outputs/job-route/',
      persistedOutputPaths: [],
      blobOutputPaths: ['outputs/job-route/0.png'],
      orphanedOutputPaths: ['outputs/job-route/0.png'],
      deletedOutputPaths: ['outputs/job-route/0.png'],
      deleteFailures: [],
    });
    const db = { query: vi.fn(), withTransaction: vi.fn() } as unknown as DB;

    vi.doMock('../../api/_lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../api/_lib/auth')>('../../api/_lib/auth');
      return {
        ...actual,
        getAuthenticatedSessionFromRequest: vi.fn(() => ({
          userId: 'user-1',
          username: 'user-1',
          displayName: 'User 1',
          user: {
            username: 'user-1',
            displayName: 'User 1',
            provisioning: 'seeded',
          },
        })),
      };
    });
    vi.doMock('../../server/neon', () => ({
      getNeonPool: vi.fn(() => db),
    }));
    vi.doMock('../../server/db', async () => {
      const actual = await vi.importActual<typeof import('../../server/db')>('../../server/db');
      return {
        ...actual,
        getJobById: getJobByIdMock,
        getJobEvents: getJobEventsMock,
      };
    });
    vi.doMock('../../server/adapters', async () => {
      const actual = await vi.importActual<typeof import('../../server/adapters')>('../../server/adapters');
      return {
        ...actual,
        reconcileJobOutputs: reconcileJobOutputsMock,
      };
    });

    const route = await import('../../api/jobs/[id]');
    const csrfToken = generateCsrfToken();
    const request = new Request('https://example.com/api/jobs/job-route', {
      method: 'POST',
      headers: {
        cookie: `csrf_token=${csrfToken}`,
        [CSRF_HEADER_NAME]: csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deleteOrphans: true }),
    });

    const response = await route.default.fetch(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(reconcileJobOutputsMock).toHaveBeenCalledWith(db, 'job-route', { deleteOrphans: true });
    expect(json.reconciliation.orphanedOutputPaths).toEqual(['outputs/job-route/0.png']);
  });

  it('blocks manual reconciliation while the job is still running', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const getJobByIdMock = vi.fn()
      .mockResolvedValueOnce(createRunningJobRow('job-route-running'));
    const reconcileJobOutputsMock = vi.fn();
    const db = { query: vi.fn(), withTransaction: vi.fn() } as unknown as DB;

    vi.doMock('../../api/_lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../api/_lib/auth')>('../../api/_lib/auth');
      return {
        ...actual,
        getAuthenticatedSessionFromRequest: vi.fn(() => ({
          userId: 'user-1',
          username: 'user-1',
          displayName: 'User 1',
          user: {
            username: 'user-1',
            displayName: 'User 1',
            provisioning: 'seeded',
          },
        })),
      };
    });
    vi.doMock('../../server/neon', () => ({
      getNeonPool: vi.fn(() => db),
    }));
    vi.doMock('../../server/db', async () => {
      const actual = await vi.importActual<typeof import('../../server/db')>('../../server/db');
      return {
        ...actual,
        getJobById: getJobByIdMock,
        getJobEvents: vi.fn(),
      };
    });
    vi.doMock('../../server/adapters', async () => {
      const actual = await vi.importActual<typeof import('../../server/adapters')>('../../server/adapters');
      return {
        ...actual,
        reconcileJobOutputs: reconcileJobOutputsMock,
      };
    });

    const route = await import('../../api/jobs/[id]');
    const csrfToken = generateCsrfToken();
    const request = new Request('https://example.com/api/jobs/job-route-running', {
      method: 'POST',
      headers: {
        cookie: `csrf_token=${csrfToken}`,
        [CSRF_HEADER_NAME]: csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deleteOrphans: true }),
    });

    const response = await route.default.fetch(request);

    expect(response.status).toBe(409);
    expect(reconcileJobOutputsMock).not.toHaveBeenCalled();
  });
});

describe('findJobByIdempotencyKey', () => {
  it('returns a proper JobRecord with Date objects via rowToJob mapper', async () => {
    const { findJobByIdempotencyKey } = await import('../../server/db');

    const created = new Date().toISOString();
    const jobRow = {
      id: 'job-idem-1',
      user_id: 'user-1',
      feature: 'lookbook',
      status: 'queued',
      idempotency_key: 'sha256-hash',
      input_payload_json: { images: 1 },
      workflow_run_id: null,
      progress_total: 1,
      progress_done: 0,
      created_at: created,
      started_at: null,
      completed_at: null,
      error_code: null,
      error_message: null,
    };

    const query = vi.fn().mockResolvedValue({ rows: [jobRow] });
    const db: DB = { query, withTransaction: vi.fn() };

    const result = await findJobByIdempotencyKey(db, 'user-1', 'sha256-hash');

    expect(result).not.toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.created_at.toISOString()).toBe(created);
    expect(result!.started_at).toBeNull();
    expect(result!.completed_at).toBeNull();
  });

  it('returns null when no matching idempotency key exists', async () => {
    const { findJobByIdempotencyKey } = await import('../../server/db');

    const query = vi.fn().mockResolvedValue({ rows: [] });
    const db: DB = { query, withTransaction: vi.fn() };

    const result = await findJobByIdempotencyKey(db, 'user-1', 'missing-key');
    expect(result).toBeNull();
  });
});

describe('sweepStaleJobs', () => {
  it('marks stale queued and running jobs as failed with TIMEOUT', async () => {
    const { sweepStaleJobs } = await import('../../server/db');

    const staleQueuedId = 'stale-queued-1';
    const staleRunningId = 'stale-running-1';

    const query = vi.fn()
      .mockResolvedValueOnce({ // find stale job IDs
        rows: [{ id: staleQueuedId }, { id: staleRunningId }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: staleQueuedId }, { id: staleRunningId }],
      }) // UPDATE stale jobs
      .mockResolvedValueOnce({ rows: [{ id: 'ev-1' }] }) // createJobEvent for staleQueuedId
      .mockResolvedValueOnce({ rows: [{ id: 'ev-2' }] }); // createJobEvent for staleRunningId

    const db: DB = { query, withTransaction: vi.fn() };

    const count = await sweepStaleJobs(db, 'user-1');

    expect(count).toBe(2);

    // Verify UPDATE query marks jobs as failed with TIMEOUT
    const updateCall = query.mock.calls[1];
    expect(updateCall[0]).toContain("SET status = 'failed'");
    expect(updateCall[0]).toContain("error_code = 'TIMEOUT'");

    // Verify job events were created
    expect(query).toHaveBeenCalledTimes(4); // find + update + 2 events
  });

  it('returns 0 when no stale jobs are found', async () => {
    const { sweepStaleJobs } = await import('../../server/db');

    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const db: DB = { query, withTransaction: vi.fn() };

    const count = await sweepStaleJobs(db, 'user-1');
    expect(count).toBe(0);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('finalizeJobOutputs transaction', () => {
  it('rolls back on failure and propagates the error', async () => {
    const { finalizeJobOutputs } = await import('../../server/db');

    const assetRow = {
      id: 'asset-1',
      job_id: 'job-tx-1',
      kind: 'output',
      blob_path: 'outputs/job-tx-1/0.png',
      mime_type: 'image/png',
      created_at: new Date().toISOString(),
    };
    const txError = new Error('event insert failed');

    const txQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [assetRow] }) // createJobAsset — succeeds
      .mockResolvedValueOnce({ rows: [] }) // updateJobStatus — succeeds
      .mockRejectedValueOnce(txError) // createJobEvent — fails
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const withTransaction = vi.fn(async <T>(fn: (tx: DB) => Promise<T>): Promise<T> => {
      const txDB: DB = {
        query: txQuery,
        withTransaction: vi.fn(),
      };
      try {
        await txDB.query('BEGIN');
        const result = await fn(txDB);
        await txDB.query('COMMIT');
        return result;
      } catch (err) {
        await txDB.query('ROLLBACK');
        throw err;
      }
    });

    const db: DB = { query: vi.fn(), withTransaction: withTransaction as DB['withTransaction'] };

    await expect(finalizeJobOutputs(db, 'job-tx-1', {
      status: 'completed',
      assets: [{ blobPath: 'outputs/job-tx-1/0.png', mimeType: 'image/png' }],
      eventPayload: {},
      traceId: 'trace-tx',
    })).rejects.toThrow('event insert failed');

    expect(txQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(txQuery).toHaveBeenLastCalledWith('ROLLBACK');
  });
});
