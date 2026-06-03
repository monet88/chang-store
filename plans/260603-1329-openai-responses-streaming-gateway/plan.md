---
title: "OpenAI Responses and Streaming Gateway"
description: "Add OpenAI SDK streaming and Responses compatibility to the existing Vertex-backed gateway, then implement real Gemini/Vertex SSE streaming."
status: pending
priority: P1
effort: "4-5d"
branch: "feat/vertex-cli-proxy-toggle"
tags: [gateway, openai, gemini, vertex, streaming, sse]
blockedBy: []
blocks: []
created: "2026-06-03T06:29:38.850Z"
createdBy: "ck:plan"
source: skill
---

# OpenAI Responses and Streaming Gateway

## Overview

Extend the existing Cloud Run gateway so clients can use OpenAI SDK streaming and
Responses-style calls against the same Vertex/Gemini backend. The plan is
incremental: first prove the upstream/SDK stream contract, then make the
existing OpenAI Chat Completions route stream, add `/openai/v1/responses`, and
finally make the existing Gemini/Vertex `streamGenerateContent` routes stream
for real.

Current code state:

- `POST /openai/v1/chat/completions` exists, but rejects `stream: true`.
- `POST /openai/v1/responses` does not exist.
- `POST /gemini/v1beta/models/{model}:streamGenerateContent` and Vertex
  stream route names classify, but route execution still calls non-streaming
  `generateContent` and returns JSON via `sendJson`.
- CodeGraph resolves gateway symbols; use CodeGraph before implementation.

## Scope Challenge

- What already exists: `gateway/src/routes/openai-compatible-routes.ts` has
  request/response translators for non-streaming Chat Completions. The app
  request pipeline is centralized in `gateway/src/app.ts`.
- Minimum change set: prove the SDK stream contract, add streaming response
  utilities and route-specific translators; avoid rewriting existing
  non-streaming behavior.
- Complexity check: public API + streaming + auth + Cloud Run means high risk.
  Scope is held around SDK-critical text/tool subset first, but production
  rollout must include abuse controls for long-lived streams.

## External Contracts

- OpenAI Chat Completions streaming uses Server-Sent Events and the SDK expects
  Chat Completion chunk objects.
- OpenAI Responses streaming emits semantic events such as
  `response.created`, `response.output_text.delta`, and `response.completed`.
- Vertex/Gemini supports `generateContent` and `streamGenerateContent`; the
  gateway must call the streaming upstream method when serving streaming routes.
- Local `@google/genai` 1.46.0 evidence shows `generateContentStream` returns a
  `Promise<AsyncGenerator<GenerateContentResponse>>` and uses `config` inside
  `GenerateContentParameters`; do not implement against a guessed
  `AsyncIterable<Record<string, unknown>>` shape.

References:

- https://platform.openai.com/docs/api-reference/chat/create
- https://platform.openai.com/docs/api-reference/responses
- https://platform.openai.com/docs/guides/streaming-responses
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference

## Cross-Plan Dependencies

| Relationship | Plan | Status | Notes |
|-------------|------|--------|-------|
| Related | `260602-2051-hybrid-vertex-gateway` | pending | Same gateway area, but current code already contains the gateway base this plan extends. No blocking dependency. |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 0 | [Upstream Stream Contract Proof](./phase-00-upstream-stream-contract-proof.md) | Pending |
| 1 | [OpenAI Chat SSE](./phase-01-openai-chat-sse.md) | Pending |
| 2 | [OpenAI Responses API](./phase-02-openai-responses-api.md) | Pending |
| 3 | [Gemini and Vertex SSE](./phase-03-gemini-and-vertex-sse.md) | Pending |
| 4 | [Validation and Rollout](./phase-04-validation-and-rollout.md) | Pending |

## Primary Touchpoints

- Modify: `gateway/src/app.ts`
- Modify: `gateway/src/lib/google-genai-client.ts`
- Modify: `gateway/src/http/request-classifier.ts`
- Modify: `gateway/src/routes/openai-compatible-routes.ts`
- Create: `gateway/src/lib/sse.ts`
- Create: `gateway/src/routes/openai-responses-routes.ts`
- Modify: `gateway/src/strategies/compatibility-strategy.ts`
- Modify: `gateway/src/routes/gemini-compatible-routes.ts`
- Modify: `gateway/src/routes/vertex-compatible-routes.ts`
- Modify: `gateway/src/lib/concurrency.ts`
- Modify: `gateway/src/lib/cors.ts`
- Modify: `gateway/package.json` or add a script if SDK smoke needs `openai`
- Add tests under `gateway/test/`
- Update `docs/api/vertex-gateway-api-guide.md` and `gcp/README.md`

## CodeGraph Baseline

- `codegraph_status`: index available, including `gateway/src`.
- `codegraph_impact(classifyRoute)`: affects `classifyRoute` and `createApp`.
- `codegraph_impact(runOpenAiCompatibleRoute)`: affects
  `runOpenAiCompatibleRoute` and `createApp`.
- Before implementation, rerun CodeGraph on any new target symbol if the code
  has changed since this plan was written.

## Red Team Review

### Session 1 - 2026-06-03

Reviewers: Security Adversary, Assumption Destroyer, Failure Mode Analyst.

| Finding | Severity | Disposition | Plan Response |
|---------|----------|-------------|---------------|
| Phase order builds OpenAI streaming before proving upstream stream contract. Evidence: `phase-02-openai-responses-api.md:7`, `phase-03-gemini-and-vertex-sse.md:56`, `gateway/src/app.ts:55`. | Critical | Accept | Added Phase 0 and made stream phases depend on its proof. |
| Mid-stream errors can fall through to app-level JSON `sendError` after SSE headers start. Evidence: `phase-01-openai-chat-sse.md:31`, `gateway/src/app.ts:77`, `gateway/src/http/error-response.ts:33`. | Critical | Accept | Phase 1 now requires streaming handlers to own post-header errors and never call JSON `sendError` on an active stream. |
| Public Cloud Run streaming endpoint lacks explicit abuse controls. Evidence: `plan.md:42`, `gcp/deploy-cloud-run.sh:39`, `gcp/deploy-cloud-run.sh:44`, `gateway/src/lib/concurrency.ts:22`. | Critical | Accept | Phase 4 now makes per-key active stream caps, bounded queues, stream lifetime limits, and deployment guidance blocking rollout criteria. |
| `@google/genai` stream API shape was guessed incorrectly. Evidence: `phase-01-openai-chat-sse.md:37`, `node_modules/@google/genai/dist/node/node.d.ts:7911`, `node_modules/@google/genai/dist/node/node.d.ts:4422`. | High | Accept | Phase 0/1 now require the real SDK signature and `config` request shape. |
| Client disconnect, timeout, and slow-reader behavior were underspecified. Evidence: `phase-01-openai-chat-sse.md:25`, `gateway/src/lib/google-genai-client.ts:5`, `gateway/src/lib/timeout.ts:3`. | High | Accept | Phase 1 now requires abort/iterator cleanup, close handling, and disconnect/backpressure tests. |
| Planned tests could pass with buffered pseudo-streaming. Evidence: `phase-01-openai-chat-sse.md:24`, `phase-01-openai-chat-sse.md:89`, `gateway/src/routes/openai-compatible-routes.ts:286`. | High | Accept | Phase 0/1/4 now require first-byte-before-completion assertions. |
| Responses API tool and `tool_choice` contract was too vague. Evidence: `phase-02-openai-responses-api.md:77`, `phase-02-openai-responses-api.md:83`. | High | Accept | Phase 2 now includes an explicit accepted/rejected tool matrix and tests. |
| Responses streaming event schema was under-specified. Evidence: `phase-02-openai-responses-api.md:53`, `phase-01-openai-chat-sse.md:31`. | High | Accept | Phase 2 now requires concrete typed event object schemas, including indexes and `sequence_number`. |
| Gemini/Vertex SDK compatibility was deferred without rollout smoke. Evidence: `phase-03-gemini-and-vertex-sse.md:78`, `phase-04-validation-and-rollout.md:58`. | High | Accept | Phase 3/4 now require local and deployed Gemini/Vertex stream SDK smokes. |
| CORS regression checks were too weak for browser-exposed keys. Evidence: `gateway/src/app.ts:30`, `gateway/src/lib/cors.ts:8`, `gcp/README.md:98`. | Medium | Accept | Phase 4 now requires production wildcard-CORS rejection guidance and hostile-origin tests. |
| OpenAI SDK smoke was planned without provisioning `openai`. Evidence: `phase-04-validation-and-rollout.md:37`, `gateway/package.json:15`. | Medium | Accept | Phase 4 now requires either an explicit `openai` dev dependency or exact external smoke command/version. |
| Rollout smoke missed Responses streaming and native stream routes. Evidence: `plan.md:116`, `phase-04-validation-and-rollout.md:66`. | Medium | Accept | Phase 4 deployed smoke matrix now includes Chat stream, Responses non-stream/stream, Gemini stream, and Vertex stream. |

### Whole-Plan Consistency Sweep

- Files reread: plan.md, phase-00-upstream-stream-contract-proof.md,
  phase-01-openai-chat-sse.md, phase-02-openai-responses-api.md,
  phase-03-gemini-and-vertex-sse.md, phase-04-validation-and-rollout.md.
- Decision deltas checked: 12.
- Reconciled stale references: 9.
- Unresolved contradictions: 0.

## Validation Log

### Session 1 - 2026-06-03

**Trigger:** User requested red-team then validate after the hard plan was drafted.
**Questions asked:** 0. Conservative defaults were applied because every material
decision had a safer blocking option in the red-team findings.

#### Verification Results

- Claims checked: 18.
- Verified: 18 | Failed: 0 | Unverified: 0.
- Tier: Full.
- Evidence:
  - `gateway/src/app.ts:55`, `gateway/src/app.ts:60`, and
    `gateway/src/app.ts:67` still send Gemini/OpenAI/Vertex route results through
    `sendJson`.
  - `gateway/src/app.ts:77` and `gateway/src/http/error-response.ts:33` route
    thrown errors to JSON `sendError`.
  - `gateway/src/lib/google-genai-client.ts:5` exposes only `generateContent`,
    while `node_modules/@google/genai/dist/node/node.d.ts:7911` exposes
    `generateContentStream`.
  - `gateway/src/routes/openai-compatible-routes.ts:286` awaits
    non-streaming `generateContent`.
  - `gateway/src/http/request-classifier.ts` has no `/openai/v1/responses`
    classifier match.
  - `gateway/src/lib/concurrency.ts:22` queues waiters without a plan-level
    bounded queue requirement before this validation.
  - `gcp/deploy-cloud-run.sh:39`, `gcp/deploy-cloud-run.sh:44`, and
    `gcp/deploy-cloud-run.sh:45` show public Cloud Run deployment with a long
    timeout and capped instance count.
  - `gateway/package.json` has no `openai` dependency for SDK smoke.

#### Confirmed Decisions

- Add a Phase 0 proof gate before translator implementation.
- Keep OpenAI Responses to a text plus basic custom-function subset first.
- Reject unsupported Responses tools and persistence/background features with
  explicit 400s before calling Gemini.
- Treat active stream caps, bounded queues, timeout/idle limits, CORS production
  restrictions, and deployed SDK smokes as rollout blockers, not nice-to-have
  follow-ups.

#### Action Items

- [ ] Implement Phase 0 proof before Phase 1 code changes.
- [ ] Use the verified OpenAI/Gemini event contracts in Phases 1-3.
- [ ] Add production abuse-control and CORS checks before Cloud Run rollout.

#### Impact on Phases

- Phase 0: new proof gate.
- Phase 1: depends on Phase 0 and now owns SSE errors/cancellation tests.
- Phase 2: depends on Phase 0/1 and now has exact Responses subset boundaries.
- Phase 3: depends on Phase 0/1 and now follows the verified Google SDK stream
  contract.
- Phase 4: now validates abuse controls, CORS, SDK dependencies, and all stream
  routes locally and after deploy.

### Whole-Plan Consistency Sweep

- Files reread: plan.md, phase-00-upstream-stream-contract-proof.md,
  phase-01-openai-chat-sse.md, phase-02-openai-responses-api.md,
  phase-03-gemini-and-vertex-sse.md, phase-04-validation-and-rollout.md.
- Decision deltas checked: 5.
- Reconciled stale references: 5.
- Unresolved contradictions: 0.

## Success Criteria

- [ ] OpenAI SDK `client.chat.completions.create({ stream: true })` receives
      valid SSE chunks from `/openai/v1/chat/completions`.
- [ ] OpenAI SDK `client.responses.create({ model, input })` works non-streaming for text
      input and simple message-array input.
- [ ] OpenAI SDK `client.responses.create({ stream: true })` receives semantic
      Responses events for text output.
- [ ] Gemini SDK-style `streamGenerateContent` route uses upstream streaming and
      no longer returns a buffered JSON response.
- [ ] Vertex `streamGenerateContent` route uses the same streaming engine where
      applicable.
- [ ] Unsupported OpenAI Responses features fail with explicit 400 errors, not
      silent malformed responses.
- [ ] First-byte-before-completion tests prove real streaming, not buffered
      pseudo-streaming.
- [ ] Public Cloud Run rollout includes active stream caps, bounded queue limits,
      stream lifetime/idle limits, and production CORS restrictions.
- [ ] Gateway tests, TypeScript compile, root typecheck, lint, and docs update
      pass.

## Not In Scope

- Persistent OpenAI Responses storage and retrieval by `response_id`.
- OpenAI built-in tools: web search, file search, computer use, code interpreter.
- Audio output, realtime API, background responses.
- Full multimodal image output parity for Responses.

## Handoff

Recommended execution command after review:

```bash
/ck:cook /media/monet/SSD Web/CodeBase/chang-store/plans/260603-1329-openai-responses-streaming-gateway/plan.md
```
