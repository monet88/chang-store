import { StudioDriverError } from '../ImageDriver';

/**
 * Options for withLocalQwenLock.
 */
export interface LocalQwenLockOptions {
  /** Optional cancellation signal that aborts queue waiting */
  signal?: AbortSignal;
}

/**
 * Diagnostics and observability snapshot for local Qwen lock state.
 */
export interface LocalQwenLockState {
  readonly isLocked: boolean;
  readonly queueDepth: number;
  readonly isBusy: boolean;
}

interface Waiter {
  resolve: () => void;
  reject: (err: unknown) => void;
  signal?: AbortSignal;
  cleanup?: () => void;
}

// Module-level lock state enforcing strict maxConcurrency: 1 across all operations
let isLocked = false;
let waitQueue: Waiter[] = [];

/**
 * Creates a normalized cancellation error conforming to StudioDriverError.
 */
function createCancellationError(reason?: unknown): StudioDriverError {
  if (reason instanceof StudioDriverError) {
    return reason;
  }
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string' && reason
        ? reason
        : 'Local Qwen generation was cancelled.';

  return new StudioDriverError('cancelled', msg, {
    retryable: false,
    cause: reason,
  });
}

/**
 * Releases the lock to the next waiting job in the queue, or resets isLocked to false.
 * Direct lock handoff ensures zero microtask barging between callers.
 */
function releaseLock(): void {
  while (waitQueue.length > 0) {
    const next = waitQueue.shift()!;
    next.cleanup?.();
    if (next.signal?.aborted) {
      next.reject(createCancellationError(next.signal.reason));
      continue;
    }
    // Direct handoff: isLocked remains true so newly arriving callers cannot barge in
    next.resolve();
    return;
  }
  isLocked = false;
}

/**
 * Enqueues a waiter into the FIFO wait queue.
 */
function acquireWaitSlot(signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const waiter: Waiter = {
      resolve,
      reject,
      signal,
    };

    if (signal) {
      const onAbort = () => {
        const idx = waitQueue.indexOf(waiter);
        if (idx !== -1) {
          waitQueue.splice(idx, 1);
        }
        waiter.cleanup?.();
        reject(createCancellationError(signal.reason));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      waiter.cleanup = () => signal.removeEventListener('abort', onAbort);
    }

    waitQueue.push(waiter);
  });
}

/**
 * Checks whether the Local Qwen engine is currently executing a job or has pending jobs queued.
 */
export function isLocalQwenBusy(): boolean {
  return isLocked || waitQueue.length > 0;
}

/**
 * Cancels all currently queued jobs waiting for the Local Qwen lock.
 * The currently active in-flight job continues until finished/cancelled by IPC.
 */
export function cancelQueuedLocalQwenJobs(reason?: string): void {
  const error = createCancellationError(reason);
  const queued = [...waitQueue];
  waitQueue = [];
  for (const waiter of queued) {
    waiter.cleanup?.();
    waiter.reject(error);
  }
}

/**
 * Inspects the current state of the Local Qwen mutex.
 */
export function getLocalQwenLockState(): LocalQwenLockState {
  return Object.freeze({
    isLocked,
    queueDepth: waitQueue.length,
    isBusy: isLocked || waitQueue.length > 0,
  });
}

/**
 * Resets the lock and cancels all waiters. Strictly for unit/integration test isolation.
 */
export function resetLocalQwenLock(): void {
  const queued = [...waitQueue];
  waitQueue = [];
  for (const waiter of queued) {
    waiter.cleanup?.();
    waiter.reject(new StudioDriverError('cancelled', 'Local Qwen lock was reset for tests', { retryable: false }));
  }
  isLocked = false;
}

export const resetLocalQwenLockForTests = resetLocalQwenLock;

/**
 * Enforces strict single-flight execution (`maxConcurrency: 1`) across all Local Qwen jobs
 * (both `generate` and `upscale`) to protect local GPU VRAM from CUDA OOM crashes.
 */
export async function withLocalQwenLock<T>(
  fn: () => Promise<T>,
  options?: LocalQwenLockOptions,
): Promise<T> {
  if (options?.signal?.aborted) {
    throw createCancellationError(options.signal.reason);
  }

  if (isLocked) {
    await acquireWaitSlot(options?.signal);
  } else {
    isLocked = true;
  }

  try {
    if (options?.signal?.aborted) {
      throw createCancellationError(options.signal.reason);
    }
    return await fn();
  } finally {
    releaseLock();
  }
}
