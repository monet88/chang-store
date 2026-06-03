import { GatewayError } from '../http/error-response.js';

interface StreamState {
  active: number;
  queue: Array<() => void>;
}

export class StreamAdmission {
  private readonly states = new Map<string, StreamState>();

  constructor(
    private readonly perKeyLimit: number,
    private readonly queueLimit: number,
  ) {}

  async acquire(key: string): Promise<() => void> {
    const state = this.states.get(key) ?? { active: 0, queue: [] };
    this.states.set(key, state);

    if (state.active < this.perKeyLimit) {
      state.active += 1;
      return () => this.release(key);
    }

    if (state.queue.length >= this.queueLimit) {
      throw new GatewayError(429, 'RATE_LIMITED', 'Too many active or queued streams for this gateway key.', true);
    }

    return new Promise((resolve) => {
      state.queue.push(() => {
        state.active += 1;
        resolve(() => this.release(key));
      });
    });
  }

  private release(key: string): void {
    const state = this.states.get(key);
    if (!state) return;

    state.active = Math.max(0, state.active - 1);
    const next = state.queue.shift();
    if (next) {
      next();
      return;
    }
    if (state.active === 0) {
      this.states.delete(key);
    }
  }
}
