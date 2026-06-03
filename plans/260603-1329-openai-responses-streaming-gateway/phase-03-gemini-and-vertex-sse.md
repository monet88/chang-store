---
phase: 3
title: "Gemini and Vertex SSE"
status: pending
priority: P1
effort: "0.5-1d"
dependencies: [0, 1]
---

# Phase 3: Gemini and Vertex SSE

## Overview

Make the existing Gemini-compatible and Vertex-compatible
`streamGenerateContent` routes actually stream instead of returning a buffered
JSON response.

## Requirements

- Functional: `/gemini/v1beta/models/{model}:streamGenerateContent` streams.
- Functional: `/vertex/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent` streams.
- Functional: non-streaming `generateContent` remains unchanged.
- Non-functional: stream output should preserve the Phase 0 verified
  Gemini/Vertex SDK-compatible chunk shape rather than forcing OpenAI shape.

## Architecture

`classifyRoute` already sets `route.stream` for Gemini and Vertex stream routes.
Use that flag in `createApp` or the compatibility route layer:

```text
route.stream === true
  -> require auth
  -> read body
  -> call ai.models.generateContentStream(request)
  -> write SSE chunks in Gemini/Vertex-compatible shape
```

Gemini/Vertex stream output should use the Phase 0 verified wire format. If the
Google SDK custom-base-url parser expects generic SSE, use `data: <json>` frames
and the verified terminator. If it expects a different raw chunk contract, update
the route and tests to that contract before implementation proceeds.

## Related Code Files

- Modify: `gateway/src/strategies/compatibility-strategy.ts`
- Modify: `gateway/src/routes/gemini-compatible-routes.ts`
- Modify: `gateway/src/routes/vertex-compatible-routes.ts`
- Modify: `gateway/src/app.ts`
- Reuse: `gateway/src/lib/sse.ts`
- Modify: `gateway/test/request-classifier.test.ts`
- Create: `gateway/test/gemini-stream-routes.test.ts`

## Implementation Steps

1. Re-check and cite the Phase 0 accepted contract for `@google/genai`
   custom-base-url `streamGenerateContent`.
2. Add streaming branch for `route.family === "gemini"` and
   `route.operation === "streamGenerateContent"`.
3. Add equivalent Vertex route streaming branch.
4. Keep `predict` and non-streaming `generateContent` on existing JSON path.
5. Add tests proving stream routes:
   - call `generateContentStream`
   - send `text/event-stream`
   - write upstream chunks
   - close with `[DONE]` or the verified SDK-compatible terminator
   - do not fall through to JSON `sendError` after stream start
   - clean up upstream iterator on client disconnect
6. Add tests proving non-streaming routes still call `generateContent`.
7. Add local SDK smoke for Gemini and Vertex stream routes, or document a
   credential-free fixture that will be repeated live in Phase 4.

## Success Criteria

- [ ] Gemini stream route no longer calls non-streaming `generateContent`.
- [ ] Vertex stream route no longer calls non-streaming `generateContent`.
- [ ] Stream routes return `text/event-stream`.
- [ ] Gemini and Vertex SDK smoke can parse the stream through the custom base
      URL contract verified in Phase 0.
- [ ] Non-streaming compatibility tests stay green.

## Risk Assessment

Risk: Google SDK custom-base-url stream parser may expect exact upstream wire
format, not generic SSE.
Mitigation: Phase 0 validates the contract before implementation and Phase 4
repeats SDK smoke before production rollout.

Risk: One streaming branch could accidentally affect image custom routes.
Mitigation: keep custom image routes isolated from compatibility streaming.
