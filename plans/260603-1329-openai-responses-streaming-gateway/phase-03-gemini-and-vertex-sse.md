---
phase: 3
title: Gemini and Vertex SSE
status: in-progress
priority: P1
effort: 0.5-1d
dependencies:
  - 0
  - 1
---

# Phase 3: Gemini and Vertex SSE

## Overview

Local implementation now routes Gemini-compatible and Vertex-compatible
`streamGenerateContent` through upstream `generateContentStream` and shared SSE
framing. This phase remains open only for SDK custom-base-url proof and rollout
validation that were not covered by the focused local tests.

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
5. Remaining: re-check and cite the Phase 0 accepted contract for
   `@google/genai` custom-base-url `streamGenerateContent`.
6. Remaining: add SDK smoke for Gemini and Vertex stream routes, or document a
   credential-free fixture that will be repeated live in Phase 4.
7. Remaining: if SDK proof rejects the current SSE format, update the helper and
   streaming route tests to match the verified wire contract.

## Success Criteria

- [x] Gemini stream route no longer calls non-streaming `generateContent`.
- [x] Vertex stream route no longer calls non-streaming `generateContent`.
- [x] Stream routes return `text/event-stream`.
- [ ] Gemini and Vertex SDK smoke can parse the stream through the custom base
      URL contract verified in Phase 0.
- [x] Focused non-streaming compatibility tests stayed green in the commits that
      introduced the local streaming branch.

## Risk Assessment

Risk: Google SDK custom-base-url stream parser may expect exact upstream wire
format, not generic SSE.
Mitigation: Phase 0 validates the contract before implementation and Phase 4
repeats SDK smoke before production rollout.

Risk: One streaming branch could accidentally affect image custom routes.
Mitigation: keep custom image routes isolated from compatibility streaming.
