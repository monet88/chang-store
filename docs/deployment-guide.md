# Deployment Guide

Chang Store deploys as a static Vite SPA. There is no custom backend server.
AI calls go directly from the browser to Google Gemini.

## Prerequisites

- Node.js and npm available locally.
- Google Gemini API key.
- Optional Google Drive OAuth configuration if Drive sync is enabled.

## Environment Variables

Vite only exposes variables with the `VITE_` prefix. This project also supports
non-prefixed `GEMINI_API_KEY` through explicit injection in `vite.config.ts`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Gemini API key injected into the client build |
| `VITE_GEMINI_API_KEY` | Alternative | Vite-prefixed fallback for Gemini key |
| `VITE_ENABLE_DIRECT_GEMINI` | Optional | Development flag for direct Gemini usage |

Production hosting must set `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY` in the
hosting dashboard.

## Build Process

```bash
npm install
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

`npm run build` produces the static output in `dist/`.

## Vercel Deployment

1. Connect the GitHub repository to Vercel.
2. Use framework preset: `Vite`.
3. Add required environment variables in Vercel project settings.
4. Deploy from the selected branch.
5. Confirm production Gemini calls work — not only the dev server.

## Static Hosting

The app can run on Vercel, Netlify, Cloudflare Pages, or any static hosting
provider that supports SPA fallback routing.

## Post-Deployment Validation

- Open the deployed URL and verify the app loads.
- Verify model selectors populate from `src/config/modelRegistry.ts` defaults.
- Run one Gemini-backed feature with a small test image.
- Verify API key errors are user-visible if the key is missing.
- If Drive sync is enabled, verify Google Drive authorization and upload flow.
