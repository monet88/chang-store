---
phase: 6
title: "OpenAI-Compatible Images Surface"
status: completed
priority: P1
effort: "1-1.5d"
dependencies: [2, 3]
---

# Phase 6: OpenAI-Compatible Images Surface

## Overview

Port the high-value OpenAI-compatible image endpoints from local `CLIProxyAPI` prior art into the gateway:

- `POST /openai/v1/images/generations`
- `POST /openai/v1/images/edits`

Keep the scope narrow: JSON-first compatibility over the existing Gemini/image workload seam. Do not expand this phase into responses websocket, compact responses, or full provider-specific image frameworks.

Important scope boundary:

- The current Chang Store fashion web app remains primarily on the Gemini-compatible `/gemini/v1beta/...` seam plus the existing custom image routes.
- This phase adds `openai/v1` image compatibility for other apps and clients that want an OpenAI-style image API.

## Requirements

- Functional: the documented supported image-model set for this phase is:
  - `gemini-2.5-flash-image`
  - `gemini-3.1-flash-image`
  - `gemini-3-pro-image`
- Functional: add `POST /openai/v1/images/generations` that accepts an OpenAI-style image-generation payload and returns an OpenAI-style JSON image response.
- Functional: add `POST /openai/v1/images/edits` that accepts OpenAI-style edit input and returns an OpenAI-style JSON image response.
- Functional: both endpoints must route through the same pooled `GenAiClient` seam used by Gemini/OpenAI/Vertex/custom image workloads.
- Functional: image generate/edit requests must respect existing gateway byte limits, image-count limits, and upstream concurrency controls.
- Functional: image edits must support both:
  - JSON payloads that carry image inputs as data URLs
  - multipart file uploads for OpenAI-style edit clients
- Functional: the compatibility surface must cover both single-image and multi-image inputs where the underlying workload already supports them.
- Functional: the compatibility surface must cover both one-image and many-image outputs through the documented `n` or equivalent request field, bounded by existing gateway limits.
- Functional: preserve the existing custom routes (`/api/images/generate`, `/api/images/edit`, `/api/images/upscale`) as first-class internal surfaces.
- Non-functional: no fake full parity claims for unsupported fields such as file IDs, hosted tools, or provider-specific extras that the gateway does not actually implement.
- Non-functional: unsupported fields such as file IDs, hosted tools, or non-data-URL remote fetches must be rejected explicitly instead of being silently ignored.

## Architecture

Recommended path:

- Add OpenAI-compatible image route classification for:
  - `/openai/v1/images/generations`
  - `/openai/v1/images/edits`
- Reuse existing `ImageWorkloads` methods as the backend execution seam where possible:
  - `generate(...)` for generations
  - `edit(...)` for edits
- Default model guidance for proof and examples:
  - `gemini-2.5-flash-image` for fast baseline generation/edit
  - `gemini-3.1-flash-image` for stronger general-purpose image generation/edit
  - `gemini-3-pro-image` for harder multi-turn or fidelity-sensitive edits
- Add thin OpenAI image request/response adapters that:
  - validate the OpenAI-style payload
  - map to the existing gateway image workload request shape
  - normalize gateway image outputs into OpenAI-style `data[]` responses
- Lock the MVP response contract explicitly:
  - return `data[].b64_json`
  - do not promise `url` responses in MVP unless a real hosted asset path exists

Scope guard:

- This phase ports the useful OpenAI image surface from local `CLIProxyAPI` reference code, especially the route shape and response contract.
- It does NOT commit to porting every `CLIProxyAPI` image feature, streaming image frames, partial image responses, or multipart upload compatibility unless explicitly added later.

Reference prior art:

- [openai_images_handlers.go](/media/monet/SSD%20Web/CodeBase/chang-store/.ref/CLIProxyAPI/sdk/api/handlers/openai/openai_images_handlers.go)

## Related Code Files

- Modify: `gateway/src/http/request-classifier.ts`
- Create: `gateway/src/routes/openai-images-routes.ts`
- Modify: `gateway/src/app.ts`
- Modify: `gateway/src/workloads/image-workloads.ts` only if adapter gaps require narrow helper extraction
- Modify: `gateway/src/routes/health-routes.ts`
- Modify: `docs/api/vertex-gateway-api-guide.md`
- Create: `gateway/test/openai-images-routes.test.ts`
- Modify: `gateway/test/root-routes.test.ts`

## Implementation Steps

1. Extend route classification to recognize `/openai/v1/images/generations` and `/openai/v1/images/edits`.
2. Add OpenAI-style request validation for prompt/model/size/count/image inputs that the gateway will support in MVP.
3. Implement a generation adapter that maps OpenAI image-generation requests onto `ImageWorkloads.generate(...)`.
4. Implement an edit adapter that maps OpenAI image-edit requests onto `ImageWorkloads.edit(...)`.
5. Implement multipart parsing for `/openai/v1/images/edits` and map uploaded files onto the existing image workload input format.
6. Normalize `ImageDto[]` outputs into an OpenAI-style response with explicit `data[].b64_json` payloads in MVP.
7. Reject unsupported payload shapes and fields with explicit 400s instead of silently ignoring them.
8. Prove pooled-client behavior still applies so image requests rotate/fail over through the same runtime seam.
9. Run focused contract tests across the supported image-model set instead of proving only one generic image model.
10. Update API docs and examples to show the new OpenAI-compatible image endpoints separately from the custom image routes and separately from the current fashion web app's Gemini-compatible seam.

## Success Criteria

- [ ] `POST /openai/v1/images/generations` returns a valid OpenAI-style JSON image response for supported payloads.
- [ ] `POST /openai/v1/images/edits` returns a valid OpenAI-style JSON image response for supported payloads.
- [ ] `POST /openai/v1/images/edits` supports both JSON data-URL input and multipart file-upload input for the documented MVP subset.
- [ ] The documented MVP response contract is explicit and stable: `data[].b64_json` is returned for generated/edited images.
- [ ] Existing `/api/images/generate`, `/api/images/edit`, and `/api/images/upscale` routes remain working.
- [ ] Tests prove single-image input, multi-image input, single-image output, and many-image output behavior for the supported subset.
- [ ] Tests prove the supported subset on `gemini-2.5-flash-image`, `gemini-3.1-flash-image`, and `gemini-3-pro-image`, with any model-specific exclusions documented explicitly.
- [ ] Unsupported OpenAI image fields are rejected explicitly, not silently ignored.
- [ ] Route tests prove gateway auth, payload limits, and image-count limits still apply.
- [ ] Image requests through the new OpenAI-compatible endpoints still use the same pooled runtime/failover seam.
- [ ] API docs clearly distinguish OpenAI-compatible image endpoints from the existing custom image endpoints.

## Risk Assessment

Risk: over-claiming OpenAI Images parity based on `CLIProxyAPI` prior art.
Mitigation: document the supported request subset explicitly and reject unsupported fields at validation time.

Risk: duplicating image business logic across custom and OpenAI-compatible routes.
Mitigation: keep route adapters thin and reuse `ImageWorkloads` as the execution seam.

Risk: image response normalization diverges from client expectations.
Mitigation: add focused contract tests for the exact `data[].b64_json` JSON shape returned by `/openai/v1/images/generations` and `/openai/v1/images/edits`.
