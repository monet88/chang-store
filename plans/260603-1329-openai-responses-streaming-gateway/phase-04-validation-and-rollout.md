---
phase: 4
title: "Validation and Rollout"
status: completed
priority: P1
effort: "0.5d"
dependencies: [0, 1, 2, 3]
---

# Phase 4: Validation and Rollout

## Overview

The streaming gateway has been validated locally and through the deployed Cloud
Run/custom-domain surface, and the docs now describe the exact SDK base URLs,
supported route matrix, and rollout guardrails.

## Requirements

- Functional: local tests cover all new route families.
- Functional: Cloud Run smoke confirms `https://gemini.monet.uno/openai/v1`,
  `/gemini`, and Vertex streaming routes where credentials allow it.
- Functional: docs include exact OpenAI SDK and Gemini SDK examples.
- Non-functional: validation must catch buffering, missing terminators, auth
  regressions, and CORS/preflight regressions.
- Non-functional: production rollout must include per-key active stream caps,
  bounded queue behavior, stream lifetime/idle limits, and hostile-origin CORS
  tests.

## Architecture

Validation layers:

1. Unit tests for translators.
2. Integration tests using local `createApp`.
3. Current focused local coverage for Gemini/Vertex stream branches.
4. Local SDK smoke scripts.
5. Cloud Run smoke after deploy.
6. Abuse-control and CORS policy checks.
7. Docs and rollout notes.

## Related Code Files

- Existing: `gateway/test/streaming-routes.test.ts`
- Existing: `gateway/test/openai-compatible-routes.test.ts`
- Modify/extend: `gateway/test/*`
- Create: `gateway/test/openai-sdk-smoke.test.ts` or script equivalent if SDK
  test is too heavy for Vitest.
- Modify: `gateway/package.json` to add `openai` as a dev dependency, or document
  an exact external SDK smoke command and version.
- Modify: `gateway/src/lib/concurrency.ts`
- Modify: `gateway/src/lib/cors.ts`
- Modify: `gcp/deploy-cloud-run.sh` or `gcp/README.md` for timeout/concurrency
  rollout guidance.
- Modify: `docs/api/vertex-gateway-api-guide.md`
- Modify: `gcp/README.md`
- Optionally modify: `docs/CHANGELOG.md`

## Implementation Steps

1. Done: run focused gateway tests, including current and future coverage:
   - request classifier
   - OpenAI chat completions
   - OpenAI responses
   - Gemini/Vertex stream routes in `gateway/test/streaming-routes.test.ts`
   - CORS and root metadata routes touched after this plan was created
2. Done: run gateway gates:
   - `npm --prefix gateway run compile`
   - `npm --prefix gateway run test`
3. Done: run repo gates:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run test` if implementation touched shared app code
4. Done: add or rerun local SDK smoke examples:
   - OpenAI `chat.completions.create({ stream: true })`
   - OpenAI `responses.create({ model, input })`
   - OpenAI `responses.create({ stream: true })`
   - Gemini SDK `streamGenerateContent`
   - Vertex SDK `streamGenerateContent` where credentials and endpoint config
     allow it
   - first-byte-before-completion assertion for each streaming smoke
5. Done: add production abuse-control tests and guidance:
   - per-key active stream cap
   - bounded queue with explicit 429/503 instead of unbounded waiters
   - max stream lifetime and idle timeout
   - disconnect cleanup
   - Cloud Run timeout/concurrency/max-instance guidance
   - optional Cloud Armor/log-based alerting guidance
6. Done: add CORS production checks:
   - forbid wildcard production CORS when browser credentials/keys are used
   - hostile-origin preflight and request tests
   - exact allowed origin docs for `GATEWAY_CORS_ORIGINS`
7. Done: after deploy, smoke:
   - `GET https://gemini.monet.uno/readyz`
   - `GET https://gemini.monet.uno/openai/v1/models`
   - `POST https://gemini.monet.uno/openai/v1/chat/completions`
   - streaming `POST https://gemini.monet.uno/openai/v1/chat/completions`
   - `POST https://gemini.monet.uno/openai/v1/responses`
   - streaming `POST https://gemini.monet.uno/openai/v1/responses`
   - streaming `POST https://gemini.monet.uno/gemini/v1beta/models/{model}:streamGenerateContent`
   - Vertex `streamGenerateContent` custom-domain smoke where route/auth config
     is available
8. Done: update docs with:
   - OpenAI SDK `baseURL: "https://gemini.monet.uno/openai/v1"`
   - Gemini SDK `baseUrl: "https://gemini.monet.uno/gemini"`
   - unsupported OpenAI Responses features
   - streaming caveats for production moderation
   - abuse-control limits and production CORS restrictions

## Success Criteria

- [x] All gateway tests pass.
- [x] Root typecheck and lint pass.
- [x] Local SDK smoke succeeds for OpenAI Chat streaming and Responses.
- [x] Local SDK smoke succeeds for Gemini/Vertex stream routes or explicitly
      documents credential-gated coverage repeated after deploy.
- [x] Focused local Gemini/Vertex stream route tests exist for SSE headers,
      upstream chunk forwarding, `[DONE]`, and disconnect cleanup.
- [x] Cloud Run custom-domain smoke succeeds after deployment.
- [x] Deployed smoke covers Responses streaming, Gemini streaming, and Vertex
      streaming where configured.
- [x] Active stream caps, bounded queues, timeout/idle limits, disconnect
      cleanup, and hostile-origin CORS tests pass.
- [x] Docs list exact supported route matrix and explicit unsupported features.

## Evidence

- Local validation passed:
  - `npm --prefix gateway run test` -> 17 files / 66 tests
  - `npm --prefix gateway run compile`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `git diff --check`
- Stream/runtime hardening landed in:
  - `gateway/src/config/env.ts`
  - `gateway/src/lib/stream-admission.ts`
  - `gateway/src/lib/stream-guards.ts`
  - `gateway/src/lib/cors.ts`
  - `gateway/src/http/sse-response.ts`
  - `gateway/src/app.ts`
- Guard coverage landed in:
  - `gateway/test/cors.test.ts`
  - `gateway/test/stream-admission.test.ts`
  - `gateway/test/streaming-routes.test.ts`
- Rollout docs/config landed in:
  - `docs/api/vertex-gateway-api-guide.md`
  - `gcp/README.md`
  - `gcp/cloud-run.env.yaml.example`
  - `gcp/deploy-cloud-run.sh`
- Deployed rollout proof:
  - built image `asia-southeast1-docker.pkg.dev/project-b82b6a5a-13c8-42e4-a56/chang-store/chang-store-vertex-gateway:20260603-224211`
  - deployed Cloud Run revision `chang-store-vertex-gateway-00007-zwv`
  - reran `node gateway/scripts/cloud-run-smoke.mjs` against
    `https://gemini.monet.uno`
  - live smoke passed for:
    - `readyz`
    - `openai-models`
    - `openai-chat`
    - `openai-chat-stream`
    - `openai-responses`
    - `openai-responses-stream`
    - `gemini-stream`
    - `vertex-stream`

## Risk Assessment

Risk: Cloud Run or an intermediate proxy buffers SSE differently from local.
Mitigation: include Cloud Run custom-domain streaming smoke before calling the
feature done.

Risk: one leaked gateway key can hold streams open and burn quota.
Mitigation: make stream caps, bounded queues, lifetime/idle limits, Cloud Run
concurrency guidance, and alerting documentation required before rollout.

Risk: Gateway API key exposure in SDK examples.
Mitigation: examples use placeholders and never document real keys.
