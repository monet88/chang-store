---
phase: 2
title: "Credential Pool Runtime"
status: completed
priority: P1
effort: "1-1.5d"
dependencies: [1]
---

# Phase 2: Credential Pool Runtime

## Overview

Replace the single `GoogleGenAI` runtime client with a small pool wrapper that preserves the existing `GenAiClient` interface and selects a target per upstream call.

## Requirements

- Functional: route Gemini, OpenAI-compatible, Vertex-compatible, and custom image workloads through the same pool seam.
- Functional: support round-robin and weighted round-robin with arbitrary target count.
- Functional: support explicit runtime reload with atomic active-snapshot swap for admin/store changes.
- Functional: preserve existing route modules as thin request translators.
- Non-functional: no hard-coded assumption that there are exactly 3 projects.
- Non-functional: no target switch after a streaming response has emitted bytes.
- Non-functional: the pool wrapper must be a **stable long-lived proxy** object. Routes and `ImageWorkloads` capture this reference once at startup; the proxy delegates internally to the active snapshot. `reload()` swaps the internal snapshot without replacing the proxy object.
<!-- Updated: Red Team Session 3 — ImageWorkloads captures stale ref, pool wrapper must be stable proxy (Findings #2, #5) -->

## Architecture

Current seam:

```ts
const ai = genAiFactory(config);
```

Target seam:

```ts
const runtime = createGenAiRuntime(config);
const ai = runtime.client; // GenAiClient stable proxy
```

`AppOptions` keeps `genAiFactory?: GenAiFactory`. The change is inside what the factory returns: instead of always returning a raw SDK client, it may return a stable proxy implementing `GenAiClient`. This keeps the existing `createApp()` seam intact while allowing internal snapshot swaps.
<!-- Updated: Validation Session 3 — keep GenAiFactory seam, return stable proxy -->

`GenAiRuntime` should own:

- `client`: a `GenAiClient`-compatible facade used by routes.
- `getSnapshot()`: redacted current pool state for health/admin.
- `reload(nextConfigOrStoreState)`: validates all targets, builds clients, and atomically swaps the active snapshot.

`GenAiPoolClient` should implement:

- `models.generateContent(request)`
- `models.generateContentStream(request)`

Selection happens inside these methods against the currently active immutable snapshot. Route modules continue to receive a `GenAiClient`.

Admin/runtime rule: a failed reload must not partially mutate the active pool. Existing in-flight requests finish on the old snapshot.

**Per-request snapshot pinning:** Every call to `generateContent()` or `generateContentStream()` must capture the active snapshot at method entry as the first synchronous operation: `const snap = this.activeSnapshot; snap.refCount++;`. The entire request (including failover retries) uses this pinned snapshot. This is safe because Node.js is single-threaded — no interleaving between the snapshot read and refcount increment within a synchronous block.
<!-- Updated: Red Team Session 3 — per-request snapshot pinning must be explicit (Finding #5) -->

**Snapshot lifecycle:** Each `GenAiPoolSnapshot` carries an atomic reference counter. Every request increments on start (before target selection) and decrements on completion/error. After `reload()` swaps the active snapshot, the old snapshot stays alive until its ref count reaches zero, then is garbage collected. No timers, no forced disposal — purely request-driven.

## Related Code Files

- Create: `gateway/src/lib/genai-pool.ts`
- Create: `gateway/src/lib/genai-runtime.ts`
- Modify: `gateway/src/lib/google-genai-client.ts`
- Modify: `gateway/src/app.ts`
- Modify: `gateway/src/workloads/image-workloads.ts` — receives the stable pool proxy at construction time; no modification needed IF the proxy pattern works correctly. Must verify that `this.ai.models.generateContent()` delegates through the proxy to the current snapshot, not a stale SDK client.
- Modify: `gateway/test/google-genai-client.test.ts`
- Create: `gateway/test/genai-pool.test.ts`
- Modify: test files that inject `genAiFactory` mocks only where the stable-proxy behavior or new pool semantics must be exercised. This is validation-surface expansion, not an `AppOptions` API rename:
  - `gateway/test/test-helpers.ts` (createTestApp)
  - `gateway/test/custom-image-routes.test.ts` (6 sites)
  - `gateway/test/openai-compatible-routes.test.ts` (15 sites)
  - `gateway/test/openai-responses-routes.test.ts` (6 sites)
  - `gateway/test/streaming-routes.test.ts` (5 sites)
  - `gateway/test/root-routes.test.ts` (1 site)
  - `gateway/test/app.test.ts`
  - `gateway/test/read-json.test.ts` (2 sites)
<!-- Updated: Red Team Session 3 — GenAiFactory test surface enumerated without changing AppOptions -->

## Implementation Steps

1. Split target creation from single-client creation: `createGoogleGenAiClientForTarget(...)`.
2. Add a `GenAiTarget` internal type with `id`, `client`, weight, enabled state, and runtime counters placeholder.
3. Add immutable `GenAiPoolSnapshot` and `GenAiRuntime.reload(...)` with validate-build-swap behavior.
4. Implement deterministic weighted round-robin selection with disabled-target skipping.
5. Make the pool wrapper satisfy `GenAiClient` so routes do not need broad signatures.
6. Add fake clients in tests that record target IDs and return deterministic responses.
7. Prove image workloads rotate through the same seam by exercising `ImageWorkloads.generate(...)` with `numberOfImages > 1`.
8. Prove failed reload leaves the previous snapshot active.

## Success Criteria

- [ ] Existing Gemini/OpenAI/Responses route tests pass with the pool wrapper.
- [ ] Pool tests prove `n=1`, `n=3`, and weighted target selection.
- [ ] Runtime tests prove successful reload swaps all future traffic and failed reload preserves old traffic.
- [ ] In-flight requests keep using their selected snapshot/target.
- [ ] Custom image generation requests are distributed through the pool.
- [ ] Route files do not duplicate target-selection logic.
- [ ] Single-client fallback behavior remains byte-for-byte compatible at public API level.

## Risk Assessment

Risk: route-level rewrites cause avoidable regressions.
Mitigation: keep route signatures on `GenAiClient` and put selection behind that interface.

Risk: pooling changes image concurrency unexpectedly.
Mitigation: keep `GATEWAY_UPSTREAM_CONCURRENCY` as the admission limiter; pool selection only chooses credentials, not parallelism.

Risk: admin writes config that does not affect live traffic.
Mitigation: Phase 2 makes reload/snapshot a runtime contract before Phase 4 admin mutation endpoints exist.
