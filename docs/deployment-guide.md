# Deployment Guide

Chang Store deploys as a static Vite SPA. There is no custom backend server.
Gemini calls go directly from the browser to Google Gemini; optional provider
studios call Grok and GPT Image REST endpoints from the browser as well.

## Prerequisites

- Node.js and npm available locally.
- Google Gemini API key for the default studio.
- Optional Grok and GPT Image keys for provider-studio defaults.
- Optional Google Drive OAuth configuration if Drive sync is enabled.

## Environment Variables

Vite only exposes variables with the `VITE_` prefix. This project also supports
non-prefixed `GEMINI_API_KEY` through explicit injection in `vite.config.ts`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Gemini API key injected into the client build |
| `VITE_GEMINI_API_KEY` | Alternative | Vite-prefixed fallback for Gemini key |
| `VITE_ENABLE_DIRECT_GEMINI` | Optional | Development flag for direct Gemini usage |
| `GROK_API_KEY` | For Grok studio | xAI API key injected into the client build |
| `VITE_GROK_API_KEY` | Alternative | Vite-prefixed fallback for the Grok key |
| `GROK_BASE_URL` | Optional | Override the Grok base URL (default `https://api.x.ai/v1`) |
| `VITE_GROK_BASE_URL` | Alternative | Vite-prefixed fallback for the Grok base URL |
| `GPT_IMAGE_API_KEY` | For GPT Image studio | OpenAI API key injected into the client build |
| `VITE_GPT_IMAGE_API_KEY` | Alternative | Vite-prefixed fallback for the GPT Image key |
| `GPT_IMAGE_BASE_URL` | Optional | Override the GPT Image base URL (default `https://api.openai.com/v1`) |
| `VITE_GPT_IMAGE_BASE_URL` | Alternative | Vite-prefixed fallback for the GPT Image base URL |

Production hosting must set `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` in the
hosting dashboard. The Grok and GPT Image studios are usable without build-time
keys — users can paste keys into each studio's settings panel at runtime (stored
in localStorage). Build-time keys only provide a default.

> Security: provider API keys are injected into the client bundle and stored in
> the browser. This is accepted for v1. A serverless proxy is planned for v2 so
> secrets never reach the client.

## Gemini Proxy / Gateway (optional)

Instead of calling Google Gemini directly, the app can route Gemini requests
through a Gemini-compatible proxy or gateway. This is configured at runtime, not
at build time:

- Open Settings → "Gemini Proxy / Gateway".
- Enable the toggle, set the proxy URL, and enter the proxy API key, then save.
- When the URL ends in `/gemini`, image edit/generate/upscale requests use the
  gateway image routes (`/api/images/*`) with an `x-api-key` header; text and
  vision requests use the `@google/genai` client with `httpOptions.baseUrl`.

Settings persist in `localStorage` (`vertex_proxy_*` keys) with fail-closed
restore validation. The proxy API key is stored as plaintext in the browser, so
only enable this on a trusted device.

This routing was verified live against `https://vertex.monet.uno/gemini` on the
2026-07-03 E2E run; see the "Live E2E Verification" section in
`docs/codebase-summary.md`.

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
- If Drive sync is enabled, verify Google Drive authorization and upload flow.
