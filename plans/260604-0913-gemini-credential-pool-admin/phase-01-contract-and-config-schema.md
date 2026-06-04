---
phase: 1
title: "Contract and Config Schema"
status: completed
priority: P1
effort: "0.75-1d"
dependencies: []
---

# Phase 1: Contract and Config Schema

## Overview

Define the durable contract for `n` Vertex/Gemini credential targets without breaking the existing single-project gateway deployment.

## Requirements

- Functional: support `vertexPools[]` with arbitrary length, per-entry `id`, `project`, `location`, credential source, enabled state, weight, labels, and optional model allow/exclude metadata.
- Functional: define `modelCatalog` as the source of truth for Gemini/OpenAI model defaults, aliases, allowlists, and disabled models.
- Functional: preserve fallback behavior for `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_VERTEX_PROJECT`, and `GOOGLE_VERTEX_LOCATION` when no pool is configured.
- Functional: expose pool mode in readiness metadata without leaking service-account private keys.
- Functional: define admin mutation gates: `enableAdminRoutes`, `adminAllowMutations`, `adminStoreMode`, Docker/VPS file-store path, and Cloud Run file-store prohibition.
- Non-functional: JSON config is the first supported nested config format; do not extend the current flat YAML parser with ad hoc nested parsing.
- Non-functional: fail startup if no valid enabled target exists.
- Non-functional: define a local `GenAiClient` interface wrapping `models.generateContent(request)` and `models.generateContentStream(request)` to decouple routes from the `@google/genai` SDK's `GoogleGenAI` type. This interface is the pool wrapper's contract and must be used by all consumers.
<!-- Updated: Red Team Session 3 — GenAiClient interface must be created (Finding #1) -->

## Architecture

Extend `GatewayConfig` and `GatewayFileConfig` in `gateway/src/config/env.ts` with pool fields. Keep a normalized config shape so later runtime code never has to guess whether it is using old single-credential config or a pool.

Recommended new types:

```ts
type VertexPoolSelection = 'round-robin' | 'weighted-round-robin';

interface VertexPoolConfig {
  id: string;
  label?: string;
  project: string;
  location: string;
  credentialsFile?: string | null;
  enabled: boolean;
  weight: number;
  modelAllowlist?: string[];
  modelExclusions?: string[];
}

interface ProviderModelCatalog {
  defaultModel?: string;
  aliases: Record<string, string>;
  allowlist: string[];
  disabled: string[];
}

type AdminStoreMode = 'static-config' | 'file-store';

interface AdminStoreConfig {
  enableAdminRoutes: boolean;
  adminAllowMutations: boolean;
  adminStoreMode: AdminStoreMode;
  adminFileStoreDir?: string;
}
```

Environment/file discovery:

- `GATEWAY_CONFIG_FILE`: existing flat config file, YAML or JSON, for current scalar/list gateway settings and single-target fallback fields.
- `GATEWAY_POOL_CONFIG_FILE`: optional JSON overlay for nested `vertexPools`, `modelCatalog`, and admin store config.
- Environment variables remain highest precedence for single-target deploys and global defaults.

**Config coexistence:** The gateway loads TWO config files:
1. Existing YAML file (flat scalars only) — gateway keys, timeouts, flags, single-credential fallback fields
2. New JSON file from `GATEWAY_POOL_CONFIG_FILE` — `vertexPools[]`, `modelCatalog`, admin config gates

Both files are merged. Env vars hold highest precedence. If the JSON file is absent and no pool config exists in env, the gateway behaves identically to today's single-credential path. This preserves backward compatibility without extending the hand-rolled YAML parser.

`modelCatalog` lives beside `vertexPools` in the JSON config, not inside the dashboard. Phase 4 admin endpoints may edit only this schema and per-target model allow/exclude metadata.

## Related Code Files

- Modify: `gateway/src/config/env.ts`
- Modify: `gateway/src/auth/google-auth.ts`
- Modify: `gateway/src/routes/health-routes.ts`
- Modify: `gateway/test/env-config.test.ts`
- Modify: `gateway/test/google-genai-client.test.ts`
- Modify: `gcp/cloud-run.env.yaml.example`
- Modify: `docs/api/vertex-gateway-api-guide.md`

## Implementation Steps

1. Add `VertexPoolConfig` and pool selection fields to config types.
2. Add `modelCatalog` config with provider-level `defaultModel`, `aliases`, `allowlist`, and `disabled`.
3. Add admin config gates: `enableAdminRoutes`, `adminToken`, `adminAllowMutations`, `adminStoreMode`, and local/Docker store path.
4. Extend JSON file validation for nested `vertexPools` and `modelCatalog`; reject nested YAML until a real parser exists.
5. Define and document explicit overlay discovery for `GATEWAY_POOL_CONFIG_FILE`; do not rely on an implied sibling file.
6. Normalize single-target fallback into a one-entry runtime view while keeping public config backward-compatible.
7. Reuse `loadServiceAccountFromFile(...)` validation (in `gateway/src/auth/google-auth.ts`) for every configured credential file.
8. Add startup guards: zero enabled targets fails; Cloud Run + file-store mutations fails because Cloud Run mutable import is out of MVP.
9. Update public readiness metadata to show only summary pool mode/counts; detailed per-target health belongs to authenticated admin APIs.
10. Document the config shape, migration behavior, and Docker/VPS volume mount recommendation.

## Success Criteria

- [ ] Existing single-credential tests still pass unchanged.
- [ ] A JSON config with 1, 3, or more pool entries loads and validates.
- [ ] Disabled entries are ignored for routing but still visible in redacted admin metadata.
- [ ] Missing `project`, `location`, invalid service-account JSON, and zero enabled targets fail with actionable errors.
- [ ] `modelCatalog` validates defaults, aliases, allowlists, and disabled model names.
- [ ] Cloud Run with `adminStoreMode: "file-store"` and mutations enabled fails fast.
- [ ] Docker/VPS config validates an explicit persistent `adminFileStoreDir`.
- [ ] Docs warn that nested pool config is JSON-first and that `GATEWAY_POOL_CONFIG_FILE` is the explicit nested overlay input.

## Risk Assessment

Risk: config ambiguity between legacy fields and `vertexPools`.
Mitigation: explicit precedence rule: pool wins when non-empty; legacy fields are fallback only.

Risk: accidentally exposing private keys through readiness.
Mitigation: readiness returns only `id`, `label`, `project`, `location`, `email`, enabled state, and health counters.

Risk: model dashboard becomes uncookable without schema.
Mitigation: `modelCatalog` is defined in Phase 1 and is the only model-management source of truth for Phase 4/5.
