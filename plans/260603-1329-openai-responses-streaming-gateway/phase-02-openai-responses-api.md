---
phase: 2
title: "OpenAI Responses API"
status: completed
priority: P1
effort: "1-1.5d"
dependencies: [0, 1]
---

# Phase 2: OpenAI Responses API

## Overview

`/openai/v1/responses` is now implemented for a deliberately small text-first
subset, with non-streaming JSON responses, semantic Responses SSE events for
`stream: true`, and non-streaming custom function tools.

## Requirements

- Functional: `POST /openai/v1/responses` works non-streaming.
- Functional: `POST /openai/v1/responses` supports `stream: true`.
- Functional: accept `input` as a string or an array of message-like items.
- Functional: map `instructions` to Gemini `systemInstruction`.
- Functional: reject unsupported built-in tools, unsupported `tool_choice`
  values, unsupported `parallel_tool_calls`, and persistence/background fields
  explicitly before calling Gemini.
- Non-functional: response objects should be SDK-parseable, even if the gateway
  does not implement storage/retrieval.
- Non-functional: streaming event objects must follow OpenAI Responses typed
  event shape, not Chat-style chunk objects.

## Architecture

Create a separate route module instead of stretching the Chat Completions file:

- `gateway/src/routes/openai-responses-routes.ts`

Translator direction:

```text
OpenAI Responses request
  -> Gemini generateContent request
  -> Gemini response
  -> OpenAI Response object or Responses SSE events
```

Minimum non-streaming response shape:

- `id: resp_<uuid>`
- `object: "response"`
- `created_at`
- `status: "completed"`
- `model`
- `output` with one assistant `message`
- `output_text`
- `usage`

Minimum streaming events:

- `response.created`
- `response.output_item.added`
- `response.content_part.added`
- repeated `response.output_text.delta`
- `response.output_text.done`
- `response.content_part.done`
- `response.output_item.done`
- `response.completed`

Each `response.output_text.delta` data object must include the verified required
fields for SDK parsing, including `type`, `item_id`, `output_index`,
`content_index`, `delta`, and `sequence_number`. Error events must use the
sanitized SSE error contract from Phase 1.

## Related Code Files

- Modify: `gateway/src/http/request-classifier.ts`
- Modify: `gateway/src/app.ts`
- Create: `gateway/src/routes/openai-responses-routes.ts`
- Reuse/extend: `gateway/src/http/sse-response.ts`
- Modify: `gateway/test/request-classifier.test.ts`
- Create: `gateway/test/openai-responses-routes.test.ts`
- Modify: `docs/api/vertex-gateway-api-guide.md`
- Modify: `gcp/README.md`

## Implementation Steps

1. Done: add route classification for `POST /openai/v1/responses`.
2. Done: add request validation:
   - require `model`
   - allow `input` string
   - allow `input` message-array subset
   - allow `instructions`
   - allow `temperature`, `top_p`, `max_output_tokens`
   - allow no `tools`, or basic custom function declarations only after the
     request schema is enumerated in tests
3. Done: reject unsupported fields with clear 400 errors:
   - `background`
   - `conversation`
   - `previous_response_id`, stored response retrieval, and persistence fields
     outside the supported subset
   - hosted/built-in tools such as web search, file search, computer use, code
     interpreter, image generation, and MCP tools
   - unsupported `tool_choice` values
   - `parallel_tool_calls: true` until tool-call streaming is proven safe
   - audio/realtime-only fields
4. Done: implement non-streaming translator and response object builder.
5. Done: implement streaming translator using Phase 1 SSE helper and Gemini upstream
   streaming.
6. Done: add tests for string input, message-array input, unsupported built-in tools,
   unsupported `tool_choice`, unsupported `parallel_tool_calls`, non-streaming
   output shape, and full typed streaming event sequence.
7. Done: update docs with SDK examples:
   - `client.responses.create({ model, input })`
   - `client.responses.create({ model, input, stream: true })`

## Success Criteria

- [x] `client.responses.create({ model, input: "Reply with exactly ok" })` has a compatible
      gateway route.
- [x] `stream: true` emits semantic Responses SSE events.
- [x] Unsupported Responses features fail explicitly.
- [x] Tests assert exact `response.output_text.delta` object fields and
      `sequence_number` monotonicity.
- [x] Tests prove unsupported hosted tools/tool choices fail before upstream
      Gemini calls.
- [x] Docs make the supported subset clear.
- [x] Gateway tests cover both non-streaming and streaming paths.

## Evidence

- Added `gateway/src/routes/openai-responses-routes.ts`.
- Updated `gateway/src/http/request-classifier.ts` and `gateway/src/app.ts` to
  dispatch `/openai/v1/responses` for both JSON and SSE flows.
- Updated `gateway/src/routes/health-routes.ts` so root metadata and readiness
  observability surfaces include the OpenAI route family.
- Added `gateway/test/openai-responses-routes.test.ts` with direct fetch and
  OpenAI SDK local-baseURL proofs for both non-streaming and streaming paths.
- Updated `gateway/test/request-classifier.test.ts`,
  `gateway/test/root-routes.test.ts`, and
  `gateway/test/stream-contract-proof.test.ts` to keep the public/API and proof
  surfaces aligned with the Responses implementation.
- Updated `docs/api/vertex-gateway-api-guide.md` and `gcp/README.md` with the
  supported subset and SDK examples.
- Validation:
  - `npm --prefix gateway run test`
  - `npm --prefix gateway run compile`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `git diff --check`

## Risk Assessment

Risk: Overclaiming Responses compatibility.
Mitigation: docs and validation name the supported subset, streaming remains
text-first, and unsupported features fail loudly before upstream calls.

Risk: SDK expects `output_text`.
Mitigation: include `output_text` in non-streaming responses and verify through
tests and local OpenAI SDK route smoke.
