import type { ServerResponse } from 'node:http';

const waitForDrainOrClose = (res: ServerResponse): Promise<'drain' | 'closed'> => new Promise((resolve) => {
  const cleanup = () => {
    res.off('drain', onDrain);
    res.off('close', onClose);
    res.off('error', onClose);
  };
  const onDrain = () => {
    cleanup();
    resolve('drain');
  };
  const onClose = () => {
    cleanup();
    resolve('closed');
  };

  res.once('drain', onDrain);
  res.once('close', onClose);
  res.once('error', onClose);
});

export const sendSseStream = async (
  res: ServerResponse,
  chunks: AsyncIterable<Record<string, unknown>>,
): Promise<void> => {
  let closed = false;
  const onClose = () => {
    closed = true;
  };

  res.once('close', onClose);
  res.once('error', onClose);

  res.statusCode = 200;
  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no');
  res.flushHeaders?.();

  try {
    for await (const chunk of chunks) {
      if (closed) return;
      let writeAccepted = false;
      try {
        writeAccepted = res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      } catch {
        return;
      }
      if (!writeAccepted && await waitForDrainOrClose(res) === 'closed') {
        return;
      }
    }
    if (!closed && !res.destroyed && !res.writableEnded) {
      try {
        res.end('data: [DONE]\n\n');
      } catch {
        // Socket closed after the state check.
      }
    }
  } finally {
    res.off('close', onClose);
    res.off('error', onClose);
  }
};
