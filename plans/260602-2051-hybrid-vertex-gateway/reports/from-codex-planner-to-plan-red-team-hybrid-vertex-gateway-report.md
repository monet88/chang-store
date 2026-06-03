# Hybrid Vertex Gateway Red Team Report

Date: 2026-06-02

Plan: `plans/260602-2051-hybrid-vertex-gateway/plan.md`

## Findings

### Finding 1: Route inventory contradiction

- Severity: High
- Location: `plan.md` Proposed API surface; Phase 02 Recommended API surface
- Flaw: health, Gemini, Vertex, `/vtx`, and root `/v1/models` were grouped under one Gemini-compatible bullet while Phase 02 used `/gemini/v1beta/models`.
- Failure scenario: implementers expose inconsistent route prefixes, the browser SDK points at root while the gateway only serves `/gemini`, and rollout fails with 404s.
- Disposition: Accept
- Fix applied: split the surface by route family and defer root aliases unless Phase 4 proves a tested migration need.

### Finding 2: SDK/auth mode underspecified

- Severity: High
- Location: Phase 01 Runtime decisions; Phase 02 Auth model
- Flaw: the plan did not explicitly forbid copying the browser `apiKey + baseUrl` client pattern into the server gateway.
- Failure scenario: Google credentials remain browser-shaped or are forwarded incorrectly, defeating the gateway's security goal.
- Disposition: Accept
- Fix applied: added explicit Node `@google/genai` Vertex-mode/client-factory requirements and server-side auth tests.

### Finding 3: Gateway key becomes a shared browser secret

- Severity: High
- Location: Phase 02 Auth model; Phase 04 Security considerations
- Flaw: temporary browser gateway key storage was acknowledged but not bounded.
- Failure scenario: a leaked localStorage key is reused from allowed origins or copied into automation, and CORS is mistaken for auth.
- Disposition: Accept
- Fix applied: added scoped keys, rotation, rate-limit hooks, redaction, and long-term removal of user-supplied gateway key UX.

### Finding 4: Base64 memory risk too vague

- Severity: High
- Location: Phase 01 Non-functional; Phase 03 Reliability policy
- Flaw: the plan named body limits but did not require exact caps, decoded-byte checks, or 413 tests.
- Failure scenario: Cloud Run instances buffer large base64 payloads, exhaust memory, and cascade failures under image edit load.
- Disposition: Accept
- Fix applied: added explicit cap-freeze, 413 rejection, no raw base64 logging, and payload tests.

### Finding 5: OpenAI-compatible route creep

- Severity: Medium
- Location: Phase 02 Recommended API surface
- Flaw: OpenAI-compatible chat and image routes increased scope without a current SPA consumer.
- Failure scenario: implementation spends time on unused compatibility while delaying the gateway migration path.
- Disposition: Accept
- Fix applied: deferred OpenAI-compatible chat until a consumer exists and kept OpenAI image route out of the initial cut.

### Finding 6: Rollout proof not concrete enough

- Severity: Medium
- Location: Phase 04 Test matrix and success criteria
- Flaw: the plan did not name enough exact tests for base URL selection, direct fallback, facade routing, provider isolation, production bundle, and smoke validation.
- Failure scenario: a dev-only pass hides a production Vite/env/base URL break.
- Disposition: Accept
- Fix applied: added exact test surfaces and required production bundle plus deployed gateway smoke proof.

## Adjudication Summary

- Accepted: 6
- Rejected: 0
- Critical: 0
- High: 4
- Medium: 2

## Whole-Plan Consistency Sweep

- Files reread: plan.md, phase-01-architecture-and-runtime.md, phase-02-auth-routing-and-compatibility.md, phase-03-image-workloads-reliability.md, phase-04-frontend-migration-and-rollout.md.
- Decision deltas checked: 6.
- Reconciled stale references: 6.
- Unresolved contradictions: 0.
