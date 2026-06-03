import type { ServerResponse } from 'node:http';

const waitForDrain = (res: ServerResponse): Promise<void> => new Promise((resolve) => {
  res.once('drain', resolve);
});

export const sendSseStream = async (
  res: ServerResponse,
  chunks: AsyncIterable<Record<string, unknown>>,
): Promise<void> => {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no');
  res.flushHeaders?.();

  for await (const chunk of chunks) {
    if (!res.write(`data: ${JSON.stringify(chunk)}\n\n`)) {
      await waitForDrain(res);
    }
  }
  res.end('data: [DONE]\n\n');
};
