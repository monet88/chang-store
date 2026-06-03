# Hybrid Vertex Gateway Validation Report

Date: 2026-06-02

Plan: `plans/260602-2051-hybrid-vertex-gateway/plan.md`

## Mode

`ck:plan validate` critical-question pass. The user instructed that every recommended option should be selected.

## Questions And Decisions

1. Route scope: explicit allowlist vs generic passthrough.
   - Selected: explicit allowlist.
   - Reason: reduces unsupported Google surface and keeps migration testable.

2. Gateway SDK/auth mode: server-side Google auth vs browser-style API key forwarding.
   - Selected: server-side Google auth.
   - Reason: the gateway exists to remove Google credentials from the browser.

3. Frontend compatibility base URL: `/gemini` suffix vs root aliases.
   - Selected: `/gemini` suffix first.
   - Reason: current SDK calls can stay Gemini-shaped while route ownership remains clear.

4. Image reliability policy: strict caps and no unsafe retry vs permissive proxy behavior.
   - Selected: strict caps and no unsafe retry.
   - Reason: image payloads are the highest memory, latency, quota, and duplicate-work risk.

5. Frontend rollout: facade-level staged migration vs hook-by-hook rewrite.
   - Selected: facade-level staged migration.
   - Reason: existing hooks already route through `imageEditingService.ts`.

6. Secrets posture: scoped gateway token and server-side Google credentials vs browser Google keys.
   - Selected: scoped gateway token and server-side Google credentials.
   - Reason: provider keys in browser are accepted legacy v1 posture, but this gateway should be the v2 secret boundary.

## Verification Evidence

- Current app evidence: `ApiProviderContext`, `apiClient`, `imageEditingService`, and `gemini/image` already support a proxy/base URL path and facade routing.
- Reference evidence: `.ref/Gemini-Vertex-Gateway` supports distinct `/gemini`, `/vertex`, and `/vtx` route families; `.ref/Vertex-AI-Proxy` supports simple authenticated image endpoints returning frontend-ready data URLs.
- Official docs: `@google/genai` supports Vertex AI mode with Node-only project/location/auth options; Google Vertex REST publisher model path uses `projects/{project}/locations/{location}/publishers/*/models/*`; Cloud Run supports Node.js 22 runtime/base images.

## Phase Propagation

- Phase 1: added runtime, env, SDK auth, body-limit, and Cloud Run base-image constraints.
- Phase 2: aligned route surface, gateway token policy, route-prefix tests, and OpenAI route deferral.
- Phase 3: added payload caps, 413 behavior, SDK response fixtures, and inline image extraction tests.
- Phase 4: added Vite env names, `/gemini` base URL migration, provider-isolation tests, and production bundle/smoke proof.

## Recommendation

Proceed only after implementation respects the route/auth decisions now recorded in the plan. The plan is no longer blocked by validation questions.
