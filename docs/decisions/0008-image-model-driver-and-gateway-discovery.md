# 0008 Image Model Driver and Gateway Discovery

Date: 2026-09-17

## Status

Accepted (implemented in phases 1-5 of `US-006-gateway-image-model-routing`).

## Context

The app routes image work through three unrelated static registries and one hand-picked gateway. Live probing on 2026-09-17 showed the registries no longer describe reality:

- `size:"9:16"` returns HTTP 200 with a `1024x1536` image — the requested ratio is silently dropped.
- `quality:"high"` comes back echoed as `medium`; the own CPA gateway ignores `size` entirely (always `1254x1254`).
- Responses arrive in three shapes across two gateways (`b64_json`, `url`, `echo_fields`); the app throws `error.provider.response.urlOnly` and discards the image on the `url` shape.
- Unsupported fields (`aspect_ratio`, `resolution`, `input_urls`) are swallowed with HTTP 200, so a miswired request looks successful.
- `GET /v1/models` is available, fast (0.23 s / 0.36 s), free, and CORS-open on both gateways, but carries **no** capability metadata (only `id/object/owned_by/created`).

So: capabilities cannot be discovered from a gateway, and the set of served models cannot be known statically.

## Decision

1. **Capabilities live in a static, evidence-dated catalog** (`src/config/imageModelCatalog.ts`): driver (API shape), size vocabulary (`ratio` | `pixel`), honored/ignored field flags, response shapes, `verifiedAt`. Unmeasured entries are `re-verify` and ship disabled. Capabilities are a registry property, never a runtime probe (each probe costs a paid generation).
2. **Gateway model *availability* is discovered at runtime** via `GET {baseUrl}/v1/models`, user-triggered only, cached 10 minutes, never on boot. Discovery decides *what is selectable*; it never decides *what a model can do*.
3. **One response adapter for the `openai-images` driver** accepts `b64_json`, else fetches `url` and converts to base64, else raises `unknownShape`. `response_format: 'b64_json'` is sent so ambiguity is removed at the source where the gateway honors it.
4. **Requests are field-disciplined**: a driver sends only capability-honored fields, because unknown fields are silently ignored upstream.
5. **Generated images are dimension-verified** against the requested pixel size and mismatches are surfaced (non-blocking warning), because a silent size fallback is what caused this decision.
6. **Capabilities are scoped to the (gateway, model) pair.** The same `modelId` measured differently on two gateways (size honored on one, ignored on the other), so descriptors carry `gatewayOverrides` keyed by host and every consumer reads `resolveCapabilities(descriptor, host)`. A capability claim without a gateway host is not a fact.
7. **Profiles are lane-scoped: one profile = one lane = one driver.** The `gemini` lane holds the single active CPA profile; the `image` lane holds the gateways specialised for OpenAI Images — many, cheap, added freely (xompet is the reference). Pickers never mix lanes and no request builder guesses an API shape from a base URL.
8. **Lane ownership is decided by gateway role, not by what the gateway happens to accept.** The CPA gateway belongs to the `gemini` lane and is not seeded into the `image` lane, even though its images routes answer 200 for `gpt-image-*` (measured: it ignores `size` and `quality`). OpenAI Images work goes to gateways that honour that contract; an operator can still add a CPA to the image lane explicitly, and the measured `gatewayOverrides` then hide the controls it cannot honour.
9. **Capability flags carry their evidence, including inconsistency.** `honorsSize` is `'yes' | 'no' | 'flaky'` with an observed rate, because one gateway answered an identical `size:1080x1920` request with `1080x1920`, `1080x1920`, then `1254x1254`. A boolean would have turned a flaky upstream into a lie; the tri-state keeps the size control, forces the dimension guard, and shows the rate in the discovery panel.

## Alternatives Considered

1. Runtime capability probing — rejected: costs a paid generation per probe (20–90 s each) and `/v1/models` exposes no capability data to shortcut it.
2. Per-gateway hardcoded model lists — rejected: the two gateways serve 32 vs 1 models; the lists drift faster than any doc update.
3. Server-side proxy for discovery/generation — rejected: measured `Access-Control-Allow-Origin: *` and OPTIONS 204 mean the browser can call the gateways directly.
4. A new image-provider abstraction beside `ProviderImageDriver` — rejected: the seam already exists (`src/hooks/providerStudioGenerationTypes.ts:22`) and the codebase forbids a second convention beside an existing one.

## Consequences

Positive:

- A wrong-size or wrong-shape request becomes visible instead of silently passing.
- Adding a gateway = adding a profile, not a code path; adding a model = adding a catalog row with evidence.
- The model picker can never offer something the configured gateway does not serve.

Tradeoffs:

- Capability facts are dated and can go stale; the operator or a scheduled probe must refresh `verifiedAt`.
- localStorage gains two keys plus a migration, and the settings modal grows a profile editor (hence the mandatory extraction to stay inside the 200-LOC ceiling).
- `url`-shape support adds one network fetch per image on gateways that answer with URLs.

## Follow-Up

- Refresh `verifiedAt` and pin the rows still marked `re-verify` — `gpt-image-1.5`, `grok-imagine-image`, `grok-imagine-image-quality`, `grok-imagine-image-2.0` on the CPA images route (listed as supported by the gateway's own 400 but not yet driven), and the xAI `grok-imagine-*` rows (no live call this session).
- Decide whether `background: "transparent"` becomes a user-facing control in the GPT Image studio (capability is proven; product decision is open).
- Revisit `#153`-adjacent stories: `US-005 Cliproxy Gateway Default` (tiny) is subsumed by the profile default here.
