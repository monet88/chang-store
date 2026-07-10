# Migrate Gemini image ops off gateway custom routes to raw SDK

- **Date**: 2026-07-10
- **Scope**: `src/services/gemini/image.ts` (single file)
- **Decision driver**: Đại Ca — gateway now serves only SDK-standard routes (`/gemini/v1beta/*`, `/openai/v1/*`); custom routes `/api/images/*` are being removed from the `vertex-gateway` repo.

## Problem

`POST https://vertex.monet.uno/api/images/edit` returns `404 Route is not enabled by the gateway allowlist.`

Root cause is in `chang-store`, not the gateway:

- `src/services/gemini/image.ts:146-154` — `getGatewayRootUrl()` strips a trailing `/gemini` from the configured Gemini base URL and returns the bare root (e.g. `https://vertex.monet.uno`).
- The three image ops (`editImage`, `generateImageFromText`, `upscaleImage`) then `POST` custom routes (`/api/images/edit`, `/api/images/generate`, `/api/images/upscale`) onto that root via `callGatewayImageRoute`.
- The `vertex-gateway` repo (commit `4f35690`, extract-gateway) dropped those custom routes from `request-classifier.ts` and `route-dispatch.ts`, so the gateway 404s them. `runCustomImageRoute` / `ImageWorkloads` are now dead code on the gateway side.

The user configures `https://vertex.monet.uno/gemini` precisely so the Google GenAI SDK hits `/gemini/v1beta/...`. Stripping `/gemini` to fire a custom route at the root is the bug.

## Direction

Gateway serves only SDK-standard routes from now on. The webapp must talk to it as a normal Gemini SDK endpoint — no custom image routes, no bespoke payload shape.

## Key finding that shrinks the diff

Every one of the three image ops already contains a **full raw-SDK fallback** in the same function body (`ai.models.generateContent` with `responseModalities: [Modality.IMAGE]` and `imageConfig`). It is simply bypassed whenever `getGatewayRootUrl()` returns non-null. So the migration is **removing the custom-route branch**, not writing new SDK call paths.

`describe` and `session/validate` custom routes do not exist in `chang-store` (grep found no callers), so they are out of scope.

## Changes

`src/services/gemini/image.ts` only:

1. **Remove** `getGatewayRootUrl`, `toGatewayImage`, `callGatewayImageRoute` (~80 lines of custom-route plumbing).
2. **`editImage`** — drop the `if (gatewayRoot && !interleavedParts)` branch; the existing `generateSingleImage` raw-SDK path (already batches via `splitIntoBatches` + `runBoundedWorkers`) becomes the only path.
3. **`generateImageFromText`** — drop the `if (gatewayRoot)` branch; the existing raw-SDK batched path becomes the only path. The `isProxyEnabled` branch (`generateProxyImage`) stays unchanged.
4. **`upscaleImage`** — drop the `if (gatewayRoot)` branch; the existing raw-SDK path becomes the only path.

No changes to: `apiClient.ts` (already builds the SDK client with `apiVersion: 'v1beta'` + the configured base URL, so the SDK auto-issues `/gemini/v1beta/models/:model:generateContent`), contexts, types, locales, or other services.

## Behavior matrix

| User config | Before | After |
|-------------|--------|-------|
| `https://vertex.monet.uno/gemini` | strips `/gemini` → `POST /api/images/edit` → **404** | SDK issues `POST /gemini/v1beta/models/:model:generateContent` ✅ |
| Direct API key (no base URL) | raw SDK ✅ | raw SDK ✅ (unchanged) |

## Auth/contract risk (requires gateway-side verify)

The custom-route path sent `x-api-key`. The Google GenAI SDK sends `x-goog-api-key`. The gateway's `requireGatewayAuth` must accept the SDK header for `/gemini/v1beta/*` routes. This is a gateway-side concern (Đại Ca's repo); flagged here so the migration is not assumed complete until a live smoke test confirms auth.

## Validation

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test` — update `__tests__/services/gemini/image.test.ts` to drop custom-route mocks and assert the three ops call `ai.models.generateContent` with the correct model + `responseModalities: [IMAGE]`.
- Live smoke (dev server, base URL `https://vertex.monet.uno/gemini`): upload `docs/image-test/people.jpg`, exercise edit/generate/upscale.

## Out of scope

- Gateway repo changes (Đại Ca): deleting `custom-image-routes.ts` + `ImageWorkloads` dead code.
- OpenAI-compatible image surface migration — rejected; raw SDK path already exists, no payload-shape conversion needed.
- `describe` / `session/validate` — no callers in `chang-store`.
