---
phase: 0
title: Upstream Stream Contract Proof
status: completed
priority: P1
effort: 0.5d
dependencies: []
---

# Phase 0: Upstream Stream Contract Proof

## Overview

Prove the upstream and SDK stream contracts before implementing translators. This
phase prevents building OpenAI and Gemini SSE behavior on an assumed wire format.

## Requirements

- Functional: verify the installed `@google/genai` stream API shape before code
  changes. Current local package evidence shows `generateContentStream(params:
  GenerateContentParameters) => Promise<AsyncGenerator<GenerateContentResponse>>`
  and request options under `config`, not top-level `generationConfig`.
- Functional: prove the expected custom-base-url stream parser behavior for
  OpenAI SDK and Google SDK clients before Phase 1/2/3 translators depend on it.
- Functional: document the accepted text streaming event/frame mapping that
  downstream phases must use. Function-call delta mapping remains a Phase 1/2
  implementation detail because the initial accepted subset is text-first.
- Non-functional: do not use production API keys in proof artifacts or reports.
- Non-functional: do not proceed to Phase 1 implementation if SDK parsing,
  upstream chunk shape, or stream terminator behavior is still unresolved.

## Architecture

Create a narrow proof harness rather than speculative production logic:

```text
installed SDK type check
  -> minimal stream factory or local fixture
  -> OpenAI SDK / Google SDK parser smoke
  -> accepted contract note for phases 1-3
```

The proof may use a local fixture server if a live credential is unavailable,
but the fixture must model the verified SDK-required event/wire format. Any live
smoke must run only against configured non-production credentials.

## Related Code Files

- Created: `gateway/test/stream-contract-proof.test.ts`.
- Modified: `gateway/package.json` and `gateway/package-lock.json` to add the
  OpenAI SDK dev dependency used by the parser smoke.
- Existing: `gateway/src/lib/google-genai-client.ts` now exposes
  `generateContentStream`; keep Phase 0 focused on proving SDK/client parser
  contracts rather than adding the wrapper from scratch.
- Existing: `gateway/src/http/sse-response.ts` now provides SSE framing for
  compatibility streams.

## Implementation Steps

1. Done: re-ran CodeGraph status before touching code.
2. Done: `stream-contract-proof.test.ts` reads the installed `@google/genai`
   declaration file through the resolved package entrypoint and asserts
   `generateContentStream(params: types.GenerateContentParameters) =>
   Promise<AsyncGenerator<types.GenerateContentResponse>>`.
3. Done: confirmed `GenerateContentParameters` uses `config?:
   GenerateContentConfig` and not top-level `generationConfig`.
4. Done: proved first-byte streaming behavior with a delayed async generator:
   the first SSE frame is written before upstream completion.
5. Done: proved fixture parsing for Google Gemini/Vertex `streamGenerateContent`
   text, function-call, finish-reason, and `[DONE]` frames.
6. Done: proved OpenAI SDK parser compatibility against a local fixture server:
   - `client.chat.completions.create({ stream: true })` consumes Chat Completion
     chunk SSE and reconstructs text deltas.
   - `client.responses.create({ stream: true })` consumes semantic Responses
     events and reconstructs `response.output_text.delta`.
7. Done: ran `npm --prefix gateway run compile` and `npm --prefix gateway run
   test`.

## Success Criteria

- [x] Local proof confirms exact `@google/genai` stream method signature and
      request config shape.
- [x] Gateway code exposes a `generateContentStream` wrapper and shared SSE
      response helper for local streaming route work.
- [x] Proof confirms first-byte-before-completion behavior.
- [x] Proof confirms the event/frame format OpenAI SDK and Google SDK clients can
      parse through a custom base URL.
- [x] Any unresolved stream-format question is listed as a blocker before Phase
      1 starts.

## Evidence

- Added `gateway/test/stream-contract-proof.test.ts`.
- Added `openai` as a gateway dev dependency for literal SDK parser proof.
- Confirmed gateway-local dependencies: `@google/genai@1.52.0` and
  `openai@6.41.0`.
- Focused proof: `npm --prefix gateway run test -- stream-contract-proof.test.ts`
  passed with 4 tests.
- Gateway validation: `npm --prefix gateway run compile` passed.
- Gateway validation: `npm --prefix gateway run test` passed with 15 test files
  and 49 tests.
- Residual live-SDK/custom-domain smoke remains in Phase 4; it is not a Phase 0
  blocker because this phase intentionally uses installed type declarations and
  a local SDK fixture server without production credentials.

## Risk Assessment

Risk: proof uses a fixture that diverges from live SDK behavior.
Mitigation: prefer live non-production smoke when credentials are available; if
not, keep the fixture contract traceable to installed SDK types and official API
docs, and repeat live smoke in Phase 4 before rollout.
