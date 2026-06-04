import type {
  GatewayConfig,
  ResolvedVertexTargetConfig,
  VertexPoolSelection,
} from '../config/env.js';
import type { GenAiClient, GenAiTargetClientFactory } from './google-genai-client.js';

export interface GenAiTarget {
  id: string;
  label?: string;
  project: string;
  location: string;
  weight: number;
  modelAllowlist: string[];
  modelExclusions: string[];
  client: GenAiClient;
}

interface WeightedTargetState {
  target: GenAiTarget;
  currentWeight: number;
}

export interface GenAiPoolSnapshot {
  version: number;
  selection: VertexPoolSelection;
  targets: readonly GenAiTarget[];
  refCount: number;
  nextIndex: number;
  totalWeight: number;
  weightedStates: WeightedTargetState[];
}

export interface GenAiPoolSnapshotView {
  version: number;
  selection: VertexPoolSelection;
  targetCount: number;
  targets: Array<{
    id: string;
    label?: string;
    project: string;
    location: string;
    weight: number;
  }>;
}

const createSnapshotTarget = (
  config: GatewayConfig,
  target: ResolvedVertexTargetConfig,
  factory: GenAiTargetClientFactory,
): GenAiTarget => ({
  id: target.id,
  ...(target.label ? { label: target.label } : {}),
  project: target.project,
  location: target.location,
  weight: target.weight,
  modelAllowlist: [...target.modelAllowlist],
  modelExclusions: [...target.modelExclusions],
  client: factory(config, target),
});

export const createGenAiPoolSnapshot = (
  config: GatewayConfig,
  factory: GenAiTargetClientFactory,
  version: number,
): GenAiPoolSnapshot => {
  const targets = config.resolvedVertexTargets.map((target) => createSnapshotTarget(config, target, factory));
  if (targets.length === 0) {
    throw new Error('GenAI pool requires at least one resolved target.');
  }
  return {
    version,
    selection: config.vertexPoolSelection,
    targets,
    refCount: 0,
    nextIndex: 0,
    totalWeight: targets.reduce((sum, target) => sum + target.weight, 0),
    weightedStates: targets.map((target) => ({ target, currentWeight: 0 })),
  };
};

export const snapshotView = (snapshot: GenAiPoolSnapshot): GenAiPoolSnapshotView => ({
  version: snapshot.version,
  selection: snapshot.selection,
  targetCount: snapshot.targets.length,
  targets: snapshot.targets.map((target) => ({
    id: target.id,
    ...(target.label ? { label: target.label } : {}),
    project: target.project,
    location: target.location,
    weight: target.weight,
  })),
});

const selectRoundRobinTarget = (snapshot: GenAiPoolSnapshot): GenAiTarget => {
  const target = snapshot.targets[snapshot.nextIndex % snapshot.targets.length];
  snapshot.nextIndex = (snapshot.nextIndex + 1) % snapshot.targets.length;
  return target;
};

const selectWeightedRoundRobinTarget = (snapshot: GenAiPoolSnapshot): GenAiTarget => {
  let winner = snapshot.weightedStates[0];
  for (const state of snapshot.weightedStates) {
    state.currentWeight += state.target.weight;
    if (state.currentWeight > winner.currentWeight) {
      winner = state;
    }
  }
  winner.currentWeight -= snapshot.totalWeight;
  return winner.target;
};

export const selectGenAiTarget = (snapshot: GenAiPoolSnapshot): GenAiTarget =>
  snapshot.selection === 'round-robin'
    ? selectRoundRobinTarget(snapshot)
    : selectWeightedRoundRobinTarget(snapshot);

const wrapPinnedStream = (
  stream: AsyncIterable<Record<string, unknown>>,
  release: () => void,
): AsyncIterable<Record<string, unknown>> => ({
  [Symbol.asyncIterator]() {
    const iterator = stream[Symbol.asyncIterator]();
    let released = false;
    const safeRelease = () => {
      if (!released) {
        released = true;
        release();
      }
    };
    return {
      next: async () => {
        try {
          const result = await iterator.next();
          if (result.done) safeRelease();
          return result;
        } catch (error) {
          safeRelease();
          throw error;
        }
      },
      return: async (value?: unknown) => {
        try {
          if (typeof iterator.return === 'function') {
            return await iterator.return(value);
          }
          return { done: true, value };
        } finally {
          safeRelease();
        }
      },
      throw: async (error?: unknown) => {
        try {
          if (typeof iterator.throw === 'function') {
            return await iterator.throw(error);
          }
          throw error;
        } finally {
          safeRelease();
        }
      },
    };
  },
});

export class GenAiPoolClient implements GenAiClient {
  readonly models = {
    generateContent: async (request: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const snapshot = this.pinSnapshot();
      try {
        const target = selectGenAiTarget(snapshot);
        return await target.client.models.generateContent(request);
      } finally {
        snapshot.refCount -= 1;
      }
    },
    generateContentStream: async (request: Record<string, unknown>): Promise<AsyncIterable<Record<string, unknown>>> => {
      const snapshot = this.pinSnapshot();
      try {
        const target = selectGenAiTarget(snapshot);
        if (!target.client.models.generateContentStream) {
          throw new Error('Configured GenAI target does not support generateContentStream.');
        }
        const stream = await target.client.models.generateContentStream(request);
        return wrapPinnedStream(stream, () => {
          snapshot.refCount -= 1;
        });
      } catch (error) {
        snapshot.refCount -= 1;
        throw error;
      }
    },
  };

  constructor(private readonly getActiveSnapshot: () => GenAiPoolSnapshot) {}

  private pinSnapshot(): GenAiPoolSnapshot {
    const snapshot = this.getActiveSnapshot();
    snapshot.refCount += 1;
    return snapshot;
  }
}
