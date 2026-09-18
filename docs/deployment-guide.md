# Deployment Guide

Chang Store deploys as a static Vite SPA. There is no custom backend server.
Every Gemini call goes from the browser to the CPA gateway
(`https://cliproxy.monet.uno`); the Grok and GPT Image studios call their own
REST endpoints from the browser as well. There is no direct-Google route: no
code path reads or injects a Google API key.

## Prerequisites

- Node.js and npm available locally.
- CPA gateway key for the default studio.
- Optional Grok and GPT Image keys for provider-studio defaults.

## Environment Variables

Vite only exposes variables with the `VITE_` prefix. This project also supports
non-prefixed names such as `CLIPROXY_API_KEY` and `GPT_IMAGE_API_KEY` through
explicit injection in `vite.config.ts`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLIPROXY_API_KEY` | Yes | CPA gateway API key injected into the client build; used when no key is stored in the browser |
| `VITE_CLIPROXY_API_KEY` | Alternative | Vite-prefixed fallback for the gateway key |
| `GROK_API_KEY` | For Grok studio | xAI API key injected into the client build |
| `VITE_GROK_API_KEY` | Alternative | Vite-prefixed fallback for the Grok key |
| `GROK_BASE_URL` | Optional | Override the Grok base URL (default `https://api.x.ai/v1`) |
| `VITE_GROK_BASE_URL` | Alternative | Vite-prefixed fallback for the Grok base URL |
| `XOMPET_API_KEY` | For the GPT Image studio | XomPet gateway key (the measured reference gateway for the image lane); wins over `GPT_IMAGE_API_KEY` |
| `VITE_XOMPET_API_KEY` | Alternative | Vite-prefixed fallback for the XomPet key |
| `XOMPET_BASE_URL` | Optional | Override the XomPet base URL (default `https://api.xompet.io.vn/v1`) |
| `VITE_XOMPET_BASE_URL` | Alternative | Vite-prefixed fallback for the XomPet base URL |
| `GPT_IMAGE_API_KEY` | Fallback | OpenAI API key injected into the client build; used only when `XOMPET_API_KEY` is unset |
| `VITE_GPT_IMAGE_API_KEY` | Alternative | Vite-prefixed fallback for the GPT Image key |
| `GPT_IMAGE_BASE_URL` | Optional | Override the GPT Image base URL (default `https://api.openai.com/v1`) |
| `VITE_GPT_IMAGE_BASE_URL` | Alternative | Vite-prefixed fallback for the GPT Image base URL |
| `GEMINI_API_KEY` | Removed | No longer read or injected: every Gemini call goes through the CPA gateway, and no client code path accepts a Google key |

Production hosting must set `CLIPROXY_API_KEY` or `VITE_CLIPROXY_API_KEY` in the
hosting dashboard. The Grok and GPT Image studios are usable without build-time
keys — users can paste keys into each studio's settings panel at runtime (stored
in localStorage). Build-time keys only provide a default.

> Security: provider API keys are injected into the client bundle and stored in
> the browser. This is accepted for v1. A serverless proxy is planned for v2 so
> secrets never reach the client.

## CPA Gateway (always on)

Every Gemini request is routed through the CPA gateway
(`https://cliproxy.monet.uno`, the CLIProxyAPI). There is no direct-to-Google
mode and no on/off toggle: the app always configures the `@google/genai` client
with `httpOptions.baseUrl` pointing at the gateway.

- The gateway API key is read from `CLIPROXY_API_KEY` (or `VITE_CLIPROXY_API_KEY`)
  at build time, injected via `vite.config.ts` `define`, and used when no key is
  stored in the browser. It can be overridden at runtime in
  Settings → "CPA Gateway", where a different gateway URL can also be set.
- The gateway must serve the Gemini routes
  (`/<version>/models/<model>:generateContent`). The client appends its own
  `v1beta` version segment, so the URL must be the origin only
  (`https://cliproxy.monet.uno`, not `.../v1beta`).
- Settings persist in `localStorage` (`cpa_gateway_url`, `cpa_gateway_api_key`),
  migrating the older `vertex_proxy_*` keys on first use, with fail-closed
  restore validation. The key is stored as plaintext in the browser, so only
  configure it on a trusted device.
- Only models the gateway actually serves may be listed in the registry; the
  registry was verified against `GET /v1/models` on 2026-09-17 and trimmed to
  `gemini-3.1-flash-image` (images) plus `gemini-3.8-flash`, `gemini-3.7-flash`,
  `gemini-3.6-flash`, `gemini-3.1-pro`, `gemini-3.5-flash-lite`, and
  `gemini-3.1-flash-lite` (text). The removed ids
  (`gemini-3-pro-image`, `gemini-3.1-flash-lite-image`, `gemini-2.5-flash-image`,
  `gemini-3.1-pro-preview`, `gemini-3.5-flash`) return
  `400 unknown provider for model`. Add a gateway and re-enable its models
  together.

This routing was verified live from the built app against
`https://cliproxy.monet.uno` on 2026-09-17: the page issued
`POST https://cliproxy.monet.uno/v1beta/models/gemini-3.1-flash-image:generateContent`
and Identity Transfer reported `1 / 1 hoàn tất · 0 lỗi` with 1792x2400 output.

## Build Process

```bash
npm install
npm run lint
npx vitest run --passWithNoTests --exclude '**/__tests__/scripts/e2e-live-config.test.ts'
npm run build
```

`npm run build` produces the static output in `dist/`.

The current checkout still contains a package test wrapper reference to the
retired scripts/check-node-platform.mjs and a tracked test import of the
retired scripts/e2e-live/config module. Full typecheck and unfiltered test
proof remain a separate tooling follow-up; see docs/TEST_MATRIX.md.

## Vercel Deployment

1. Connect the GitHub repository to Vercel.
2. Use framework preset: `Vite`.
3. Add required environment variables in Vercel project settings.
4. Deploy from the selected branch.
5. Confirm production Gemini calls and any configured provider-studio calls work — not only the dev server.

## Static Hosting

The app can run on Vercel, Netlify, Cloudflare Pages, or any static hosting
provider that supports SPA fallback routing.

## Optional Backend Gateway

If you do not want browser clients to hold Google Vertex credentials or direct
Gemini API access, an optional backend gateway is available in a separate repo:
https://github.com/monet88/vertex-gateway

- Clone that repo for the local Docker flow and Cloud Run deployment artifacts.
- App API usage and feature behavior are unchanged whether or not the gateway
  is used.

## Post-Deployment Validation

- Open the deployed URL and verify the app loads.
- Verify model selectors populate from `src/config/modelRegistry.ts` defaults.
- Run one Gemini-backed feature with a small test image.
- If Grok/GPT Image keys are configured, switch studios and run one provider-backed workflow.
- Verify API key errors are user-visible if a required key is missing.
