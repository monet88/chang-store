---
phase: 1
title: "OpenAI Chat SSE"
status: completed
priority: P1
effort: "1d"
dependencies: [0]
---

# Phase 1: OpenAI Chat SSE

## Overview

OpenAI-compatible Chat Completions now support `stream: true` with
`text/event-stream`, while preserving the existing non-streaming response path.
The implementation deliberately keeps Phase 1 to the text-first subset: one
choice, no streaming tool-call deltas, and explicit pre-header rejection for
unsupported risky features.

## Requirements

- Functional: `POST /openai/v1/chat/completions` accepts `stream: true`.
- Functional: return OpenAI Chat Completion chunk SSE events followed by
  `data: [DONE]`.
- Functional: keep existing non-streaming chat completions unchanged.
- Non-functional: no buffering full upstream response before first text delta.
- Non-functional: close streams cleanly on client disconnect and stop upstream
  iteration where the SDK allows it.
- Non-functional: after SSE headers are written, the streaming branch must own
  every error path and must not fall through to JSON `sendError`.
- Non-functional: streaming errors expose only stable, sanitized error codes and
  messages; never raw upstream exception text, stack traces, credentials, or
  filesystem paths.

## Architecture

Add an SSE helper that owns headers and event formatting:

- `writeSseJson(res, payload)`
- `writeSseDone(res)`
- `writeSseError(res, safeError)`

Extend `GenAiClient` with the real SDK stream shape verified in Phase 0:

```ts
generateContentStream: (
  params: GenerateContentParameters,
  options?: { signal?: AbortSignal }
) => Promise<AsyncGenerator<GenerateContentResponse>>
```

If the installed SDK does not accept an `AbortSignal`, the route still must call
`return()` on the async generator when available, stop writing downstream, and
document the residual upstream-cancellation limitation.

`createApp` should branch after auth/body parsing:

1. classify `/openai/v1/chat/completions`
2. if `body.stream === true`, call a streaming handler
3. streaming handler writes SSE directly, catches post-header errors itself, and
   returns without `sendJson`
4. non-streaming handler remains the existing path

## Related Code Files

- Reuse/extend: `gateway/src/http/sse-response.ts`
- Modify: `gateway/src/lib/google-genai-client.ts`
- Modify: `gateway/src/routes/openai-compatible-routes.ts`
- Modify: `gateway/src/app.ts`
- Modify: `gateway/test/openai-compatible-routes.test.ts`

## Implementation Steps

1. Done: used CodeGraph to re-check `createApp`, `runOpenAiCompatibleRoute`, and
   `GenAiClient` call surfaces.
2. Done: reuse `GenAiClient.models.generateContentStream` with the Phase 0
   verified `config` request shape.
3. Done: extended `gateway/src/http/sse-response.ts` with reusable JSON,
   error, and done SSE helpers plus iterator cleanup and post-header error
   ownership.
4. Done: split OpenAI chat handling into non-streaming and streaming functions
   without changing existing non-streaming output shape.
5. Done: convert each Gemini stream chunk into an OpenAI
   `chat.completion.chunk` object:
   - `id`
   - `object: "chat.completion.chunk"`
   - `created`
   - `model`
   - `choices[0].delta.role`
   - `choices[0].delta.content`
   - `choices[0].finish_reason`
6. Done: end every successful stream with `data: [DONE]`.
7. Done: add streaming error ownership:
   - before headers: regular JSON `sendError` is allowed
   - after headers: write sanitized SSE error/final frames where compatible,
     close cleanly, and never let the outer app catch append JSON
8. Done: add disconnect/backpressure handling:
   - `req`/`res` close listeners
   - async-generator `return()` cleanup when supported
   - shared SSE helper now also closes iterators on disconnect
   - max stream lifetime and idle timeout remain Phase 4 rollout work
9. Done: add explicit 400 handling for unsupported streaming features that are too
   risky for Phase 1, such as complex tool-call argument deltas if the upstream
   shape cannot be converted safely.
10. Done: add tests for:
   - stream headers
   - multiple chunks
   - `[DONE]`
   - client receives no JSON wrapper
   - first SSE chunk arrives before a delayed upstream generator completes
   - upstream throws after headers start and no JSON error is appended
   - client disconnect stops downstream writes and performs upstream cleanup
   - slow-reader/backpressure path does not buffer the whole upstream response
   - non-streaming test remains green

## Success Criteria

- [x] `stream: true` no longer returns `VALIDATION_FAILED`.
- [x] SSE response has `content-type: text/event-stream`.
- [x] Test verifies at least two `chat.completion.chunk` events plus `[DONE]`.
- [x] Test proves first chunk arrives before upstream generator completion.
- [x] Post-header errors stay SSE-framed/sanitized and never emit JSON.
- [x] Client disconnect test proves upstream iterator cleanup.
- [x] Existing non-streaming OpenAI Chat test still passes.
- [x] Gateway compile and tests pass.

## Evidence

- `gateway/src/app.ts` now branches `POST /openai/v1/chat/completions` to a
  dedicated streaming handler when `body.stream === true`.
- `gateway/src/routes/openai-compatible-routes.ts` now exposes
  `runOpenAiCompatibleStreamRoute(...)`, translates Gemini stream chunks into
  OpenAI `chat.completion.chunk` frames, writes `[DONE]`, and rejects
  unsupported streaming tools pre-header.
- `gateway/src/http/sse-response.ts` now provides reusable SSE JSON/error/done
  helpers and explicitly closes iterators on disconnect or post-header failure.
- `gateway/test/openai-compatible-routes.test.ts` now covers success streaming,
  first-byte-before-completion, post-header sanitized errors, disconnect
  cleanup, and unsupported streaming-tool rejection.
- Validation:
  - `npm --prefix gateway run compile`
  - `npm --prefix gateway run test -- openai-compatible-routes.test.ts stream-contract-proof.test.ts streaming-routes.test.ts`
  - `npx tsc --noEmit`
  - `npm run lint`

## Risk Assessment

Risk: SDKs are strict about SSE framing.
Mitigation: Phase 0 already proved the accepted Chat chunk fixture against the
OpenAI SDK parser; Phase 4 still needs live custom-base-url SDK smoke.

Risk: a leaked key can hold long-lived streams open.
Mitigation: Phase 1 exposes stream lifecycle hooks; Phase 4 makes active stream
caps, bounded queues, idle limits, and Cloud Run timeout guidance blocking
rollout requirements.

Risk: `@google/genai` stream chunk shape may differ between SDK versions.
Mitigation: keep translator defensive and based on `candidates[].content.parts`.
