import { describe, expect, it, vi } from 'vitest';
import { withImageRequestSlot } from '@/utils/request-slots';
import { DEFAULT_MAX_CONCURRENCY } from '@/utils/engineDispatch';

/** A task that reports when it starts and only finishes when the test says so. */
const createPendingTask = () => {
  let started = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });

  return {
    task: async () => {
      started += 1;
      await gate;
      return started;
    },
    startedCount: () => started,
    release,
  };
};

describe('withImageRequestSlot', () => {
  it('runs up to the cap at once and queues the rest', async () => {
    const holders = Array.from({ length: DEFAULT_MAX_CONCURRENCY }, () => createPendingTask());
    const running = holders.map((holder) => withImageRequestSlot(holder.task));

    await Promise.resolve();
    expect(holders.every((holder) => holder.startedCount() === 1)).toBe(true);

    const queued = createPendingTask();
    const queuedRun = withImageRequestSlot(queued.task);
    await Promise.resolve();
    // Eleven concurrent image requests would be what a 10-job batch of 4-image
    // jobs asks for; the eleventh waits for a slot instead of hitting the
    // gateway.
    expect(queued.startedCount()).toBe(0);

    holders.forEach((holder) => holder.release());
    await Promise.all(running);
    await vi.waitFor(() => expect(queued.startedCount()).toBe(1));
    queued.release();
    await queuedRun;
  });

  it('frees its slot when the task throws', async () => {
    const failures = Array.from({ length: DEFAULT_MAX_CONCURRENCY }, () =>
      withImageRequestSlot(async () => { throw new Error('429'); }).catch(() => 'failed'),
    );
    await Promise.all(failures);

    await expect(withImageRequestSlot(async () => 'ok')).resolves.toBe('ok');
  });
});
