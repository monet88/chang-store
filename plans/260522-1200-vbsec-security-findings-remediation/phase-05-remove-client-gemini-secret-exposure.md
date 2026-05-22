---
phase: 5
title: "Remove Client Gemini Secret Exposure"
status: completed
priority: P1
effort: "1-3d"
dependencies: [1, 2]
---

# Phase 5: Remove Client Gemini Secret Exposure

## Context Links

- Source report: `vbsec-reports/scan-2026-05-22-113905.md`
- Related files: `vite.config.ts`, `src/services/imageEditingService.ts`, `src/services/gemini/`, `src/contexts/ApiProviderContext.tsx`
- Finding: high #3

## Overview

Stop embedding Gemini API keys into the browser bundle. Route Gemini requests through a server-side proxy or approved backend surface where the key remains server-only.

## Key Insights

- Vite `define` replaces `process.env.API_KEY` and `process.env.GEMINI_API_KEY` at build time, so values can be extracted from the JavaScript bundle.
- A SPA cannot keep a third-party API key secret if it directly calls Gemini from the browser.
- The durable fix uses a Vercel/Netlify serverless function for production; local direct Gemini mode is allowed only as an explicit non-production escape hatch.

## Requirements

- Functional: all existing Gemini-backed features continue to work through current hooks and service facade.
- Functional: production client bundle contains no Gemini API key value and no direct dependency on secret build-time injection.
- Non-functional: do not bypass `src/services/imageEditingService.ts`; keep service routing centralized.

## Architecture

Target data flow:

```text
Component -> Feature Hook -> imageEditingService.ts -> App API proxy -> Gemini SDK/API
```

The client sends only validated request payloads. The proxy reads `GEMINI_API_KEY` from server environment and calls Gemini. The client never receives the key. If a temporary local development mode is needed, keep it explicitly non-production and document it as a development-only escape hatch.

Validated implementation decision:
- Production target: Vercel/Netlify serverless API route/function.
- Local development: direct Gemini mode may remain only behind an explicit non-production flag.
- Production deployment is blocked until the serverless proxy is wired and verified.

## Related Code Files

- Modify: `vite.config.ts`
- Modify: `src/services/imageEditingService.ts`
- Modify: `src/services/gemini/*` as needed to route calls through proxy instead of browser SDK for production.
- Modify: `src/contexts/ApiProviderContext.tsx` only if provider semantics need to represent server-backed mode.
- Create: proxy endpoint files after hosting target is selected.
- Modify docs: deployment/security docs for server-side key configuration.

## Implementation Steps

1. Run GitNexus impact analysis for `imageEditingService` and Gemini service functions that will be rerouted.
2. Add a Vercel/Netlify-compatible serverless API route/function with server-only `GEMINI_API_KEY` access, strict request schema validation, payload cap, and a 10 req/min per-client rate limit target.
3. Remove `process.env.API_KEY` and `process.env.GEMINI_API_KEY` from Vite `define` for production builds.
4. Keep any direct client Gemini mode behind an explicit non-production development flag.
5. Route production Gemini service calls through `imageEditingService.ts` to the proxy endpoint.
6. Keep request/response contracts typed and validate payloads at the proxy boundary.
7. Add tests for service request construction, proxy error handling, payload rejection, rate-limit behavior, and production build flag leakage.
8. Build the app and inspect `dist/` for `GEMINI_API_KEY`, `API_KEY`, and any real key-like value.
9. Smoke-test at least Try-On and one other Gemini-backed feature against the proxy.

## Todo List

- [ ] Implement Vercel/Netlify serverless proxy target.
- [ ] Map all Gemini client call paths.
- [ ] Remove production key injection from Vite config.
- [ ] Implement explicit dev-only direct mode if still needed.
- [ ] Reroute service facade.
- [ ] Add proxy contract, validation, rate-limit, and production flag-leak tests.
- [ ] Verify bundle contains no secret.
- [ ] Smoke-test Gemini features.

## Success Criteria

- [ ] No Gemini API key is embedded in production JavaScript.
- [ ] `vite.config.ts` does not define `process.env.GEMINI_API_KEY` into client bundle for production.
- [ ] All Gemini calls go through `imageEditingService.ts` and the selected proxy/backend.
- [ ] Proxy validates request inputs, enforces a payload cap, rate-limits abusive clients, and returns user-safe errors.
- [ ] Production build test proves dev-only direct Gemini mode and API key defines cannot leak into production.
- [ ] `npm run build`, `npm run test`, `npm run lint`, and `npx tsc --noEmit` pass.

## Risk Assessment

Risk is high because this changes the AI integration boundary. Mitigate by making the proxy target an explicit user decision, preserving existing service facade signatures where possible, and validating with real Gemini calls.

## Security Considerations

Do not use client-obfuscated keys, hidden source maps, or runtime string tricks as a fix. They do not protect secrets in a SPA. Server-side secret storage is required.

## Next Steps

After implementation, Phase 6 must verify both code behavior and bundle contents before production deployment.

## Validation Decisions

- Production proxy target: Vercel/Netlify serverless function.
- Local development may keep direct Gemini calls only behind an explicit non-production flag.

## Open Questions

None.
