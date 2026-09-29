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

  it('never hands out more slots than the cap, even when a waiter is woken', async () => {
    let inFlight = 0;
    let peak = 0;
    // A body that stays suspended until the test releases it, so the number of
    // simultaneously suspended bodies IS the number of slots held.
    const body = (holder: ReturnType<typeof createPendingTask>) => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await holder.task();
      inFlight -= 1;
    };

    // Fill the cap: one request finishes on its own and frees a slot, the rest
    // hold. That freed slot is then contested by a queued request and by a caller
    // already sitting in the microtask queue — the woken waiter resumes last.
    const quick = withImageRequestSlot(async () => {});
    const held = Array.from({ length: DEFAULT_MAX_CONCURRENCY - 1 }, () => createPendingTask());
    const running = held.map((holder) => withImageRequestSlot(body(holder)));
    const contested = createPendingTask();
    const queued = withImageRequestSlot(body(contested));
    const late = Promise.resolve().then(() => withImageRequestSlot(body(contested)));

    // setImmediate drains the microtask queue without guessing a duration.
    await new Promise((resolve) => setImmediate(resolve));
    const observedPeak = peak;
    held.forEach((holder) => holder.release());
    contested.release();
    await Promise.all([quick, ...running, queued, late]);

    expect(observedPeak).toBeLessThanOrEqual(DEFAULT_MAX_CONCURRENCY);
  });
});
