---
phase: 3
title: "Health Metrics and Failover"
status: pending
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 3: Health Metrics and Failover

## Overview

Add health state, counters, cooldown, and failover rules so one exhausted or failing project does not take down the whole gateway.

## Requirements

- Functional: track success/failure counters per target.
- Functional: mark targets unhealthy on quota/auth/timeout classes and cool them down for a bounded interval.
- Functional: surface summary pool status in public `/readyz` and detailed per-target health in authenticated admin APIs.
- Functional: fail over non-streaming requests when the selected target fails before a response is returned.
- Non-functional: streaming failover is pre-downstream-yield only. The pool wrapper may retry another target until it has yielded the first chunk to the route/SSE helper; after that, the selected target is pinned.
- **OpenAI Responses streaming restructure:** The Responses route currently emits scaffold SSE events BEFORE the first `iterator.next()`. To enable failover for Responses streaming, the route must be restructured to defer scaffold events until after the first successful `next()`. Sequence: (1) `generateContentStream()`, (2) first `next()`, (3) emit scaffold events + first data chunk. Failures at steps 1-2 trigger pool-level failover transparently.
- Non-functional: health counters must survive target scheduling within the active snapshot and reset only on explicit reload.
- Non-functional: when ALL enabled targets are on cooldown, the scheduler must select the target whose cooldown expires soonest and attempt the request anyway (with a warning log). The gateway must never silently drop requests or hang when all targets are temporarily unhealthy.
<!-- Updated: Validation Session 3 — Responses route restructured for failover instead of excluded -->

## Architecture

Add a small state object per target:

```ts
interface GenAiTargetHealth {
  status: 'healthy' | 'cooldown' | 'disabled';
  success: number;
  failure: number;
  recent: Array<{ at: string; ok: boolean; code?: string }>;
  lastErrorCode?: string;
  lastErrorAt?: string;
  cooldownUntil?: number;
}
```

Error classification should stay conservative: only retry/failover errors that are clearly transient, quota-related, timeout-related, or upstream service errors. Do not retry malformed request errors.

## Related Code Files

- Modify: `gateway/src/lib/genai-pool.ts`
- Create: `gateway/src/lib/upstream-error-classifier.ts`
- Modify: `gateway/src/routes/health-routes.ts`
- Modify: `gateway/src/http/request-context.ts` for target-id logging only if needed.
- Create/modify: `gateway/test/genai-pool.test.ts`
- Modify: `gateway/test/root-routes.test.ts`
- Modify: `gateway/test/streaming-routes.test.ts`

## Implementation Steps

1. Implement target health counters and a bounded recent-request ring buffer.
2. Add error classification for auth, quota, timeout, network, and invalid request classes.
3. Implement cooldown and target skipping in the scheduler.
4. Add failover for non-streaming calls before the route sends output.
5. Add streaming guard: wrap both `await target.generateContentStream(...)` and the first `iterator.next()` attempt, then retry another target only if the pool wrapper has not yielded any chunk to the downstream consumer.
6. **Restructure OpenAI Responses streaming route:** Defer scaffold SSE events (`response.created`, `output_item.added`, `content_part.added`) until after the first successful upstream `iterator.next()`. Current code emits these scaffold events before the iterator loop — refactor to: (1) call `generateContentStream()`, (2) call first `next()`, (3) only then write scaffold events + first data chunk. This enables the pool wrapper’s failover to work transparently for Responses streaming.
7. Keep `/readyz` to summary pool mode/counts/limits only; expose detailed per-target status, emails, cooldowns, and recent failures through authenticated admin health APIs.
8. Add route-family labels to health events: `gemini`, `vertex`, `openai-chat`, `openai-responses`, and `images`.
9. Implement all-targets-cooldown fallback: when no healthy target exists, select the target with shortest remaining cooldown and attempt anyway. Log a warning about full-pool cooldown.
<!-- Updated: Validation Session 3 — Responses route restructured for failover -->

## Success Criteria

- [ ] One failing target cools down and traffic moves to healthy targets.
- [ ] Invalid request errors do not cause noisy cross-project retries.
- [ ] Streaming tests prove failover works when the upstream promise rejects before returning an iterable.
- [ ] Streaming tests prove failover works when the first upstream `iterator.next()` rejects before yielding data.
- [ ] Streaming tests prove no target switch after the pool wrapper has yielded its first downstream chunk.
- [ ] OpenAI Responses streaming scaffold events are deferred until after the first successful `iterator.next()` — enabling failover before scaffold emission.
- [ ] When all enabled targets are on cooldown, the scheduler selects the shortest-remaining-cooldown target and logs a warning.
- [ ] `/readyz` reports only summary-safe pool mode/counts plus existing limits.
- [ ] Authenticated admin health reports detailed redacted per-target status, cooldown, counters, and route-family buckets.
- [ ] Health/recent request buckets identify route family without logging prompt text or credential data.
- [ ] Logs include selected target ID but never private key material.

## Risk Assessment

Risk: broad retrying can multiply cost or hide real bad requests.
Mitigation: retry/failover only for classified transient/quota/timeout/server errors.

Risk: health state is process-local and multi-instance Cloud Run will have independent counters.
Mitigation: document this explicitly; use it for routing within an instance, not global quota truth.
