import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeJob, partialJob, reconcileJobOutputs } from '../../server/adapters/base-adapter';
import type { DB } from '../../server/db';
import { CSRF_HEADER_NAME, generateCsrfToken } from '../../api/_lib/csrf';

function createRunningJobRow(jobId: string) {
  return {
    id: jobId,
    user_id: 'user-1',
    feature: 'lookbook',
    status: 'running',
    idempotency_key: 'idem-1',
    input_payload_json: {},
    workflow_run_id: null,
    progress_total: 1,
    progress_done: 0,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: null,
    error_code: null,
    error_message: null,
  };
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
      .mockResolvedValueOnce({ rows: [] }) // updateJobStatus
      .mockResolvedValueOnce({ rows: [{ id: 'ev-1' }] }); // createJobEvent

    const db = createMockDB({ jobQuery, txQuery });

    const result = await completeJob(db, 'job-complete', [
      { blobPath: 'outputs/job-complete/0.png', mimeType: 'image/png' },
    ], 'trace-complete');

    expect(result).toHaveLength(1);
    expect(result[0].blob_path).toBe('outputs/job-complete/0.png');
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
      .mockResolvedValueOnce({ rows: [] }) // updateJobStatus
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

describe('runFeatureJob cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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

  it('runs manual reconciliation for the authenticated job owner', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const getJobByIdMock = vi.fn()
      .mockResolvedValueOnce(createRunningJobRow('job-route'));
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
        getAuthenticatedUserFromRequest: vi.fn(() => ({
          username: 'user-1',
          displayName: 'User 1',
          provisioning: 'seeded',
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
      .mockResolvedValueOnce({ rows: [] }) // UPDATE stale jobs
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
