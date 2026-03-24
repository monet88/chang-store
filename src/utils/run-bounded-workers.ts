/**
 * Run async jobs with a fixed worker count.
 * Each job handles its own success/error state so sibling jobs continue.
 */
export async function runBoundedWorkers<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  const queue = [...items];
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));

  const runNext = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift();

      if (!item) {
        return;
      }

      await worker(item);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
}
