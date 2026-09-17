# Exec Plan

## Goal

Make model selection honest and gateway-agnostic: one capability-driven image-model catalog (Lớp 1) plus gateway profiles with on-demand model availability validation (Lớp 2), so the app requests only sizes/fields the configured gateway actually honors and never silently accepts a wrong-size image.

## Scope

In scope:

- `src/config/imageModelCatalog.ts` (new) — drivers, capabilities, descriptor list, derived exports for the three existing registries, catalog integrity invariants.
- `src/services/gatewayDiscoveryService.ts` (new) — `GET {baseUrl}/v1/models`, status mapping, TTL cache.
- Gateway profiles: storage + legacy-key migration + `GatewayProfileEditor.tsx`/`useGatewayProfiles.ts` extracted from `SettingsModal`/`useSettingsModalState`.
- `openai-images` response adapter (`url` → fetch → base64), `response_format: 'b64_json'`, dimension guard on generated images.
- Model picker filtering (`catalog ∩ served`, `chưa xác minh` group) in `GlobalModelSelector`/`SettingsModal` and provider studios.
- i18n keys (`en.ts` + `vi.ts`), tests, product docs, CHANGELOG.

Out of scope:

- `gateway/**` (the deployed gateway server) and any server-side change.
- Prompt builders, gallery, batch concurrency guards, feature flows.
- Automatic paid capability probing.
- Any new provider studio or new gateway account.

## Risk Classification

Risk flags (intake #153):

- **External systems** — two third-party gateways, unstable response shapes, silently ignored fields.
- **Public contracts** — model list, size vocabulary, and generation request/response behavior are user-visible.
- **Existing behavior** — `cpa_gateway_*` storage, `configureGeminiClient`, and all provider studios keep working.
- **Data model** — localStorage layout changes (profiles + cache) with a migration path for legacy keys.

Hard gates:

- **External provider behavior** — verified by live probes recorded in `validation.md`, not by assumption.
- Removing or weakening validation is **not** on the table: `url`-only responses become *supported*, never *ignored*.

## Work Phases

1. **Catalog foundation (Lớp 1).** Add `imageModelCatalog.ts`; rewrite `gptImageModelRegistry.ts`, `grokModelRegistry.ts`, and the `RegisteredModel`/`ModelCapability` site (`modelRegistry.ts`) to derive from it; keep exported names stable so no consumer changes in this phase. Add the catalog invariant test. No behavior change.
2. **Driver discipline (Lớp 1).** Request builders send only capability-honored fields (`gptImageService.ts` gains `response_format`, honors `honorsSize`/`honorsQuality`); add the `url` → fetch → base64 branch in `openaiCompatibleResponse.ts`; add the dimension guard with `getImageDimensions`. Red-first: the `url`-only test must fail on HEAD (`error.provider.response.urlOnly`).
3. **Discovery service (Lớp 2a).** `gatewayDiscoveryService.ts` + status mapping + 10-min TTL cache + mocked-fetch test matrix (ok/401/403/500/network/malformed/abort).
4. **Profiles & settings UI (Lớp 2b).** Profile storage with legacy migration in `ApiProviderContext`: legacy `cpa_gateway_*`/`vertex_proxy_*` ⇒ the single `gemini`-lane profile; `provider:gptImage:*` / `provider:grok:*` ⇒ `image`-lane profiles for their respective drivers. **The CPA host is never seeded into the `image` lane** (see design invariant 11). Extract `GatewayProfileEditor.tsx` + `useGatewayProfiles.ts` with the two lists; wire per-profile **Kiểm tra** to the discovery service; i18n keys.
5. **Pickers & studios (Lớp 2c).** Lane-scoped pickers: Gemini features read the gemini-lane profile's served list; GPT Image / Grok studios get a provider selector above the model selector and list `catalog ∩ served(profile)` with the `unverified` group; provider studio model + size options come from the catalog (adds `1080x1920` for `gpt-image-2.5-sunburst`).
6. **Verification & docs.** Full gates, live browser smoke against both gateways, product doc + CHANGELOG updates, Harness story status.

Each phase ends with its own focused test run; the full gate battery runs once at the end (`npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`).

## Stop Conditions

Pause for human confirmation if:

- Discovery returns a shape that is not `{data:[{id,...}]}` on a gateway we intend to support (the status mapping would need a new branch).
- A phase would break `cpa_gateway_*`/`provider:*` storage consumers that other in-flight work depends on.
- A capability flag cannot be pinned by a live probe without spending a credit the operator has not approved.
- The picker intersection would hide a model the operator currently uses (needs an explicit "keep selectable" decision).
- Verification requirements would have to be weakened (not allowed without explicit human sign-off).
