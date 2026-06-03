---
phase: 3
title: Gemini and Vertex SSE
status: completed
priority: P1
effort: 0.5-1d
dependencies:
  - 0
  - 1
---

# Phase 3: Gemini and Vertex SSE

## Overview

Gemini-compatible and Vertex-compatible `streamGenerateContent` now route
through upstream `generateContentStream`, use a native SDK-compatible SSE shape
without OpenAI-style `[DONE]`, and have local Google SDK custom-base-url proof
for both `/gemini` and `/vertex`.

## Requirements

- Functional: `/gemini/v1beta/models/{model}:streamGenerateContent` streams.
- Functional: `/vertex/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent` streams.
- Functional: non-streaming `generateContent` remains unchanged.
- Non-functional: stream output should preserve the Phase 0 verified
  Gemini/Vertex SDK-compatible chunk shape rather than forcing OpenAI shape.

## Architecture

`classifyRoute` sets `route.stream` for Gemini and Vertex stream routes, and
`createApp` now uses that flag to call `sendSseStream(...)` with
`runCompatibilityStreamRoute(...)`:

```text
route.stream === true
  -> require auth
  -> read body
  -> call ai.models.generateContentStream(request)
  -> write SSE chunks in Gemini/Vertex-compatible shape
```

The remaining risk is parser compatibility, not the local route branch. Phase 0
still needs to prove whether Google SDK custom-base-url parsing accepts the
current `data: <json>` frames and `[DONE]` terminator.

## Related Code Files

- Existing: `gateway/src/http/sse-response.ts`
- Existing: `gateway/src/strategies/compatibility-strategy.ts`
- Existing: `gateway/src/app.ts`
- Existing: `gateway/test/streaming-routes.test.ts`
- Modify if SDK proof disagrees: `gateway/src/http/sse-response.ts`
- Modify if SDK proof disagrees: `gateway/src/strategies/compatibility-strategy.ts`
- Extend: `gateway/test/streaming-routes.test.ts`

## Implementation Steps

1. Done locally: add streaming branch for Gemini `streamGenerateContent`.
2. Done locally: add equivalent Vertex route streaming branch.
3. Done locally: keep `predict` and non-streaming `generateContent` on existing
   JSON path.
4. Done locally: add focused tests proving stream routes call
   `generateContentStream`, send `text/event-stream`, write upstream chunks, end
   with `[DONE]`, and clean up on disconnect.
5. Done: re-check and cite the Phase 0 accepted contract for
   `@google/genai` custom-base-url `streamGenerateContent`.
6. Done: add local Google SDK smoke for Gemini and Vertex stream routes.
7. Done: update the shared SSE helper so native Gemini/Vertex streams end on
   EOF instead of `data: [DONE]`, which the Google SDK parser rejects.

## Success Criteria

- [x] Gemini stream route no longer calls non-streaming `generateContent`.
- [x] Vertex stream route no longer calls non-streaming `generateContent`.
- [x] Stream routes return `text/event-stream`.
- [x] Gemini and Vertex SDK smoke can parse the stream through the custom base
      URL contract verified in Phase 0.
- [x] Focused non-streaming compatibility tests stayed green in the commits that
      introduced the local streaming branch.

## Evidence

- `gateway/src/http/sse-response.ts` now supports protocol-specific stream
  termination so native Gemini/Vertex routes close on EOF instead of appending
  `[DONE]`.
- `gateway/src/app.ts` explicitly passes `includeDone: false` for native Gemini
  and Vertex stream routes.
- `gateway/test/streaming-routes.test.ts` now proves:
  - native Gemini stream route returns `text/event-stream` without `[DONE]`
  - native Vertex stream route returns `text/event-stream` without `[DONE]`
  - the official `GoogleGenAI` SDK can stream through both local custom base
    URL contracts
  - idle timeout failures stay inside sanitized SSE error framing
- Validation:
  - `npm --prefix gateway run test -- streaming-routes.test.ts`
  - `npm --prefix gateway run test`
  - `npm --prefix gateway run compile`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `git diff --check`

## Risk Assessment

Risk: Google SDK custom-base-url stream parser may reject OpenAI-like stream
terminators.
Mitigation: native Gemini/Vertex routes now terminate on EOF and are covered by
direct local SDK smoke.

Risk: One streaming branch could accidentally affect image custom routes.
Mitigation: keep custom image routes isolated from compatibility streaming.
