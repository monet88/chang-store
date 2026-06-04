---
phase: 7
title: "Validation and Rollout"
status: pending
priority: P1
effort: "0.75-1d"
dependencies: [5, 6]
---

# Phase 7: Validation and Rollout

## Overview

Prove the pool, admin surface, and rollout posture first on local Docker, then on a Linux VM/VPS with Docker. The MVP deploy path is Docker plus a persistent mounted `file-store` volume, and local Docker is the mandatory proof gate before any VM deployment.

## Requirements

- Functional: existing public gateway routes stay compatible.
- Functional: optional smoke proves pool readiness and per-target test route when configured.
- Functional: Docker/VPS docs show persistent volume mounts for credential JSON and admin file-store config.
- Functional: compatibility matrix proves all existing gateway public contracts still work under pool mode.
- Functional: local Docker must be the first deploy target and must pass endpoint smoke before Linux VM rollout is allowed.
- Non-functional: no dashboard/admin route is enabled accidentally in production.
- Non-functional: validation must include security/redaction tests.

## Architecture

Rollout profile:

1. Local/test: fake clients and file-store admin tests.
2. Local Docker: mount `./gateway-data/auths:/data/auths`, enable admin with a local token, and verify import/test/reload.
3. Local Docker proof gate: run the full endpoint checklist and require smooth results before VM rollout.
4. Linux VM/VPS Docker: same compose/env path with persistent disk-backed `gateway-data/auths`.
5. Live dashboard import smoke: upload one service-account JSON, verify redacted list/detail, test target, disable/enable, delete or replace, restart container, and confirm persistence/reload.

Compatibility matrix:

| Surface | Required proof |
|---|---|
| OpenAI Chat JSON | existing response shape still passes |
| OpenAI Chat SSE | `[DONE]`, first-byte-before-completion, disconnect cleanup |
| OpenAI Responses JSON | text-first response object and unsupported-feature rejects |
| OpenAI Responses SSE | semantic SSE events and `[DONE]` |
| OpenAI Images Generate | supported `/openai/v1/images/generations` JSON contract passes |
| OpenAI Images Edit | supported `/openai/v1/images/edits` JSON contract passes |
| Gemini native JSON | `generateContent` route with pool target selection |
| Gemini native SSE | Google SDK stream smoke, no `[DONE]` |
| Vertex native SSE | Google SDK stream smoke through `/vertex`, failover before downstream yield, no target switch after downstream first chunk |
| Custom image generate | multiple image calls distribute through pool while respecting upstream concurrency |
| Admin/security | disabled-by-default, `Authorization: Bearer` required, gateway API keys ignored, admin CORS isolated from public CORS, redaction/log/error tests |
| Legacy app migration | current fashion web app keeps working on `/gemini/v1beta/...` by changing only `baseURL` + gateway `apiKey` |
| Supported image models | `gemini-2.5-flash-image`, `gemini-3.1-flash-image`, `gemini-3-pro-image` all have explicit proof or explicit documented exclusions |

## Related Code Files

- Modify: `gateway/scripts/cloud-run-smoke.mjs`
- Modify: `gcp/cloud-run.env.yaml.example`
- Modify: `gcp/deploy-cloud-run.sh` only if new secret mounts/env flags need script support.
- Modify: `gcp/README.md`
- Modify: `docs/api/vertex-gateway-api-guide.md`
- Modify: `gateway/test/*` touched by earlier phases.

## Implementation Steps

1. Run full gateway unit/integration suite.
2. Run root TypeScript, lint, app tests, and production build.
3. Add optional smoke flags for pool health and target test checks.
4. Document Docker Compose volume mounting and `file-store` config examples.
5. Add config/startup tests for Cloud Run file-store mutation guard by setting `K_SERVICE`.
6. Add tests for runtime reload success/failure and admin rollback behavior.
7. Deploy to local Docker with `gateway-data/auths` mounted.
8. Run the full local Docker smoke for readyz, Gemini JSON/stream, OpenAI chat/Responses JSON/stream, OpenAI image generation/edit, and custom image generation. Fix rough edges locally until the endpoint surface is smooth.
9. Include current fashion web app image patterns in the local Docker proof:
   - one input image -> one output image
   - one input image -> many output images
   - many input images -> one output image where supported
   - many input images -> many output images where supported
   - Gemini-compatible `/gemini/v1beta/...` client path still works through the gateway
   - repeat the supported image scenarios across:
     - `gemini-2.5-flash-image`
     - `gemini-3.1-flash-image`
     - `gemini-3-pro-image`
   - if any scenario is model-specific or excluded, document that explicitly in rollout notes
10. Verify admin login/list/import/test/disable/enable/delete flows through `file-store`, then restart the local container and verify imported accounts remain.
11. Prove `/readyz` stays summary-only while detailed per-target health is available only behind authenticated admin APIs.
12. Only after the full local Docker gate passes, deploy to Linux VM/VPS Docker with the same mounted-volume layout and rerun the focused smoke.

## Success Criteria

- [ ] `npm --prefix gateway run test` passes.
- [ ] `npm --prefix gateway run compile` passes.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, and `npm run build` pass.
- [ ] `git diff --check` passes.
- [ ] `gateway/scripts/cloud-run-smoke.mjs` passes against local or deployed service.
- [ ] Local Docker is the first deploy target and passes the full compatibility smoke before any Linux VM rollout.
- [ ] `/readyz` stays summary-only and exposes no per-target emails, recent failures, or private key fields.
- [ ] Admin remains disabled unless explicitly enabled.
- [ ] Compatibility matrix above has explicit unit/integration/smoke evidence.
- [ ] Local Docker proof covers the current fashion web app seam on `/gemini/v1beta/...`, not only the OpenAI-compatible surfaces.
- [ ] Local Docker proof covers one-image/many-image input-output patterns for the supported custom image and OpenAI-compatible image routes.
- [ ] Local Docker proof covers `gemini-2.5-flash-image`, `gemini-3.1-flash-image`, and `gemini-3-pro-image`, with any model-specific exclusions written down explicitly before VM rollout.
- [ ] Log/error redaction tests include `private_key`, `private_key_id`, raw credential JSON, and generic thrown errors.
- [ ] Admin auth tests prove only `Authorization: Bearer <GATEWAY_ADMIN_TOKEN>` works for `/admin/api/*`; query/cookie/API-key transports fail.
- [ ] Admin routing/CORS tests prove `/admin` and `/admin/api/*` do not inherit public wildcard CORS or public gateway auth behavior.
- [ ] Cloud Run file-store mutation startup guard is tested with `K_SERVICE`.
- [ ] Local Docker `file-store` import/list/test/delete and restart-persistence smoke is documented or run before VM rollout.
- [ ] Linux VM/VPS rollout happens only after the local Docker gate passes and reproduces the mounted-volume config cleanly.
- [ ] Admin mutation tests prove runtime reload success and rollback on reload failure.
- [ ] Legacy app migration proof shows the current fashion web app client can switch to the gateway by changing only `baseURL` + gateway `apiKey`.

## Risk Assessment

Risk: live deploy consumes quota across multiple projects faster than expected.
Mitigation: start with low weights, observe per-target counters, and keep existing upstream concurrency limits.

Risk: enabling admin on public domain exposes a high-impact surface.
Mitigation: separate token, same-origin route, admin disabled by default, and optional network restriction/domain protection before live use.

Risk: compatibility baseline regresses while pool tests pass.
Mitigation: Phase 6 carries an explicit surface-by-surface compatibility matrix from the completed streaming gateway plan.
