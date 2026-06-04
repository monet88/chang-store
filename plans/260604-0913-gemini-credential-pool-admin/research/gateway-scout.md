# Gateway Scout

## Summary

Current gateway runtime has a clean single seam for pooling: `createApp()` constructs one `GenAiClient` and passes it to Gemini, OpenAI-compatible, Vertex-compatible, Responses, and custom image workloads. The plan should preserve route modules and put pooling behind a `GenAiClient`-compatible runtime wrapper with atomic snapshot reload.

## Findings

- `gateway/src/config/env.ts` currently supports one `googleProject`, `googleLocation`, and `googleCredentialsFile`.
- `gateway/src/lib/google-genai-client.ts` creates one `GoogleGenAI` client with fixed `project`, `location`, `apiVersion`, and optional service-account `googleAuthOptions`.
- `gateway/src/app.ts` passes the same `ai` instance to all upstream model routes.
- `ImageWorkloads` also uses `ai.models.generateContent(...)`, so image generation is covered if the pool wraps `GenAiClient`.
- `readyz` currently reports one Google auth status and should become redacted pool-aware.
- Admin mutations must not only write config/store state; they must reload/swap the live pool or fail without changing traffic.

## Recommendation

Implement `GenAiRuntime` with a `GenAiClient` facade, immutable active snapshots, and explicit reload/swap behavior. Avoid copying pool logic into route files.

## Key Risks

- Streaming failover after the pool wrapper has yielded its first downstream chunk would break SSE semantics; failure before that downstream yield can still retry, including first `iterator.next()` rejection.
- Retry/failover on invalid requests can multiply cost and hide real client bugs.
- Health counters are process-local in Cloud Run and should not be treated as global quota truth.

## Validation Commands

```bash
npm --prefix gateway run test
npm --prefix gateway run compile
npx tsc --noEmit
npm run lint
npm run test
npm run build
```
