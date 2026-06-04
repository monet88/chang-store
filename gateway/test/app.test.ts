import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { testConfig } from './test-config.js';

class FakeRequest extends EventEmitter {
  method = 'GET';
  url = '/';
  headers: Record<string, string> = {};
  destroy = vi.fn();
}

class FakeResponse extends EventEmitter {
  statusCode = 0;
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  readonly endCalls: Array<string | undefined> = [];
  readonly headerCalls: Array<[string, string]> = [];

  setHeader(name: string, value: string): void {
    this.headerCalls.push([name, value]);
  }

  once(eventName: string | symbol, listener: (...args: Array<unknown>) => void): this {
    return super.once(eventName, listener);
  }

  off(eventName: string | symbol, listener: (...args: Array<unknown>) => void): this {
    return super.off(eventName, listener);
  }

  end(chunk?: string): void {
    this.endCalls.push(chunk);
    if (!this.headersSent) {
      this.headersSent = true;
      throw new Error('socket write failed after headers');
    }
    this.writableEnded = true;
  }
}

describe('app error fallback', () => {
  it('does not append a JSON error payload after headers were already sent', async () => {
    const server = createApp({
      config: testConfig(),
      genAiFactory: () => ({ models: { generateContent: vi.fn() } }),
    });
    const handler = server.listeners('request')[0] as (
      req: IncomingMessage,
      res: ServerResponse,
    ) => Promise<void>;

    const req = new FakeRequest();
    const res = new FakeResponse();

    await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

    expect(res.endCalls).toHaveLength(2);
    expect(res.endCalls[0]).toContain('"message":"Chang Store Vertex Gateway"');
    expect(res.endCalls[1]).toBeUndefined();
    expect(res.endCalls.join(' ')).not.toContain('"success":false');
    expect(
      res.headerCalls.filter(([name]) => name.toLowerCase() === 'content-type'),
    ).toHaveLength(1);
  });
});
