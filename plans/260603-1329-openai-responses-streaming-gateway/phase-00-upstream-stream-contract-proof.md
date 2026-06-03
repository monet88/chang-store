---
phase: 0
title: "Upstream Stream Contract Proof"
status: pending
priority: P1
effort: "0.5d"
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
- Functional: document the accepted chunk-to-text and chunk-to-function-call
  mapping that downstream phases must use.
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

- Create: `gateway/test/stream-contract-proof.test.ts` or script equivalent.
- Modify: `gateway/src/lib/google-genai-client.ts` only after the proof defines
  the exact wrapper contract.
- Optionally modify: `gateway/package.json` if SDK smoke requires an explicit
  `openai` dev dependency instead of an `npx`/external script.
- Update: this plan's downstream phase notes if the proof finds a non-SSE Google
  SDK wire format requirement.

## Implementation Steps

1. Re-run CodeGraph for `GenAiClient`, `createApp`, and the route handlers before
   touching code.
2. Verify local `@google/genai` package version and type signatures, including
   whether the SDK exposes an abort/cancel option for stream requests.
3. Build a minimal proof that awaits `generateContentStream(...)` before
   iterating and records the real chunk shape.
4. Prove first-byte streaming behavior with a delayed async generator: first SSE
   frame must be observable before the generator completes.
5. Prove SDK parsing for:
   - OpenAI Chat streaming frames.
   - OpenAI Responses semantic typed events.
   - Google Gemini/Vertex `streamGenerateContent` frames or the verified
     alternative wire format.
6. Write a short accepted contract note in the test/script comments or docs used
   by Phases 1-3.

## Success Criteria

- [ ] Local proof confirms exact `@google/genai` stream method signature and
      request config shape.
- [ ] Proof confirms first-byte-before-completion behavior.
- [ ] Proof confirms the event/frame format OpenAI SDK and Google SDK clients can
      parse through a custom base URL.
- [ ] Any unresolved stream-format question is listed as a blocker before Phase
      1 starts.

## Risk Assessment

Risk: proof uses a fixture that diverges from live SDK behavior.
Mitigation: prefer live non-production smoke when credentials are available; if
not, keep the fixture contract traceable to installed SDK types and official API
docs, and repeat live smoke in Phase 4 before rollout.
