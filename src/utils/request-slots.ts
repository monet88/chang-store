import { DEFAULT_MAX_CONCURRENCY } from './engineDispatch';

/**
 * Global gate on in-flight cloud image requests, shared by every engine lane.
 *
 * Job concurrency alone does not bound requests: a job may fan out one request
 * per output image, so `resolveEngineConcurrency` jobs of 4 images each would
 * put 40 requests on the wire and run into gateway rate limits. One queue caps
 * what actually leaves the app, whichever lane the jobs belong to.
 */
let activeImageRequests = 0;
const waiters: Array<() => void> = [];

export const withImageRequestSlot = async <T>(task: () => Promise<T>): Promise<T> => {
  if (activeImageRequests >= DEFAULT_MAX_CONCURRENCY) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  activeImageRequests += 1;
  try {
    return await task();
  } finally {
    activeImageRequests -= 1;
    waiters.shift()?.();
  }
};
