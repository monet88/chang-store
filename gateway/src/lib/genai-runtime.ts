import type { GatewayConfig } from '../config/env.js';
import {
  createGenAiPoolSnapshot,
  GenAiPoolClient,
  snapshotView,
  type GenAiPoolSnapshot,
  type GenAiPoolSnapshotView,
} from './genai-pool.js';
import {
  createGoogleGenAiClientForTarget,
  type GenAiClient,
  type GenAiTargetClientFactory,
} from './google-genai-client.js';

export interface GenAiRuntimeSnapshotView {
  mode: GatewayConfig['runtimeMode'];
  active: GenAiPoolSnapshotView;
}

export class GenAiRuntime {
  readonly client: GenAiClient;

  private version = 0;
  private activeSnapshot: GenAiPoolSnapshot;
  private currentConfig: GatewayConfig;

  constructor(
    config: GatewayConfig,
    private readonly factory: GenAiTargetClientFactory = createGoogleGenAiClientForTarget,
  ) {
    this.currentConfig = config;
    this.activeSnapshot = createGenAiPoolSnapshot(config, this.factory, this.version);
    this.client = new GenAiPoolClient(() => this.activeSnapshot);
  }

  getSnapshot(): GenAiRuntimeSnapshotView {
    return {
      mode: this.currentConfig.runtimeMode,
      active: snapshotView(this.activeSnapshot),
    };
  }

  reload(nextConfig: GatewayConfig = this.currentConfig): GenAiRuntimeSnapshotView {
    const nextSnapshot = createGenAiPoolSnapshot(nextConfig, this.factory, this.version + 1);
    this.activeSnapshot = nextSnapshot;
    this.currentConfig = nextConfig;
    this.version = nextSnapshot.version;
    return this.getSnapshot();
  }
}

export const createGenAiRuntime = (
  config: GatewayConfig,
  factory?: GenAiTargetClientFactory,
): GenAiRuntime => new GenAiRuntime(config, factory);
