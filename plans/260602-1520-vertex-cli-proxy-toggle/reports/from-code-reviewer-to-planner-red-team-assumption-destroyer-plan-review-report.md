# Plan Review Report: Vertex CLI Proxy Toggle
**Reviewer Perspective:** Hostile Assumption Destroyer & Scope Auditor
**Date:** 2026-06-02

---

## Finding 1: Lack of Initial Sync of Proxy Settings on App Boot / Page Refresh
- **Severity:** Critical
- **Location:** Phase 2, section "Overview" and "Implementation Steps"
- **Flaw:** The plan details how proxy state is loaded from localStorage into React state via `useState` and how changes are committed on Save. However, it fails to specify that these values must be synced from the React context to the `apiClient` singleton module-level variables on initial mount.
- **Failure scenario:** The user enables the proxy, sets the proxy URL and API key, and saves the settings. On the next page refresh, `vertexProxyEnabled`, `vertexProxyUrl`, and `vertexProxyApiKey` will correctly load from `localStorage` into `ApiProviderContext` React state. However, because there is no sync to `apiClient` on load, the module-level variables (`customApiKey`, `customBaseUrl`) in `apiClient.ts` will remain `null`. As a result, subsequent Gemini calls will silently bypass the proxy and hit the direct Gemini API until the user opens settings and clicks Save again.
- **Evidence:** `src/contexts/ApiProviderContext.tsx:75` shows how state is loaded (e.g., `googleApiKey` starts as `null`), but the plan does not contain any initialization hook to run `setGeminiBaseUrl(vertexProxyUrl)` and `setGeminiApiKey(vertexProxyApiKey)` when the provider mounts.
- **Suggested fix:** Add a `useEffect` inside `ApiProviderContext.tsx` that runs on mount to apply the loaded proxy URL and key to the `apiClient` setters: `setGeminiBaseUrl(vertexProxyEnabled ? vertexProxyUrl : null)` and `setGeminiApiKey(vertexProxyEnabled ? vertexProxyApiKey : null)`.

---

## Finding 2: Type-Level Compilation Error via Invalid `numberOfImages` inside `ImageConfig`
- **Severity:** Critical
- **Location:** Phase 3, section "Architecture"
- **Flaw:** The plan's proposed architecture for calling `ai.models.generateContent()` specifies passing `{ aspectRatio, numberOfImages: 1 }` inside the `imageConfig` object. However, the `@google/genai` SDK's `ImageConfig` interface does not have a `numberOfImages` field.
- **Failure scenario:** When the TypeScript compiler runs `npx tsc --noEmit`, compilation will fail because `ImageConfig` has no property `numberOfImages`, blocking the build pipeline.
- **Evidence:** `node_modules/@google/genai` types (specifically `ImageConfig` at line 254 in the types file `/home/monet/.bun/install/cache/@google/genai@2.7.0@@@1/dist/node/node.d.ts`) shows that `ImageConfig` only supports `aspectRatio`, `imageSize`, `personGeneration`, `prominentPeople`, `outputMimeType`, etc., and does not contain `numberOfImages`.
- **Suggested fix:** Remove `numberOfImages: 1` from the `imageConfig` object passed to `ai.models.generateContent`. Since the loop already runs one request at a time, `numberOfImages` is not needed inside `imageConfig`.

---

## Finding 3: Race Condition and Multiple Re-renders via Un-grouped State Setters
- **Severity:** High
- **Location:** Phase 2, section "Requirements" and "Implementation Steps"
- **Flaw:** The plan proposes three independent states `vertexProxyEnabled`, `vertexProxyUrl`, and `vertexProxyApiKey`. During a single "Save" operation, the hook updates all three states independently. This can lead to multiple intermediate re-renders and potential `useEffect` executions where the proxy is enabled, but the URL or API key is not yet updated, causing invalid client instantiation.
- **Failure scenario:** When the user enables the proxy and types a new URL and key, clicking "Save" calls `setVertexProxyEnabled(true)`, `setVertexProxyUrl(newUrl)`, and `setVertexProxyApiKey(newKey)`. The context's `useEffect` may trigger after `setVertexProxyEnabled(true)` but before the key/URL states are updated, invoking `setGeminiBaseUrl(oldUrl)` and `setGeminiApiKey(oldKey)`, creating a misconfigured client instance.
- **Evidence:** `src/contexts/ApiProviderContext.tsx:94-105` shows a grouped configuration pattern used for provider settings: `providerSettings: Record<ProviderId, ProviderSettings>`. The proxy settings should follow this grouped approach.
- **Suggested fix:** Group the proxy settings into a single object state `vertexProxySettings` with keys `enabled`, `url`, and `apiKey`, and a single setter `setVertexProxySettings(settings)`. This guarantees atomic updates and prevents intermediate state mismatches.

---

## Finding 4: Text Helper and Analyze Scene API Failures via Hardcoded `thinkingConfig` on Flash Models
- **Severity:** Critical
- **Location:** Phase 4, section "Requirements" and "Implementation Steps"
- **Flaw:** The plan proposes migrating text helpers (like `generateImageDescription`, `generateClothingDescription`, etc.) and text generation defaults in `text.ts` to `gemini-3.5-flash`. However, these helpers and the `generateText` function currently hardcode `thinkingConfig: { thinkingBudget: 32768 }` in their config objects.
- **Failure scenario:** `gemini-3.5-flash` is a standard Flash model and does not support thinking configurations. When these services are invoked using `gemini-3.5-flash` with the hardcoded `thinkingConfig` passed to `ai.models.generateContent`, the Gemini API will return a 400 Bad Request / Validation error, causing text generation and visual analysis to crash.
- **Evidence:** `src/services/gemini/text.ts:13-15`, `219-221`, and `278-280` show hardcoded `thinkingConfig` blocks inside `generateText`, `generateStylePromptFromImage`, and `analyzeScene`.
- **Suggested fix:** Ensure that `thinkingConfig` is only applied when the selected model actually supports thinking (e.g., check `modelId` or capabilities), or completely omit `thinkingConfig` when routing to `gemini-3.5-flash`.

---

## Finding 5: Stale Default Text Model Assertions causing Test Failures
- **Severity:** Medium
- **Location:** Phase 5, section "Test Plan"
- **Flaw:** The plan specifies modifying text service tests for Gemini 3/3.1 defaults but fails to address other test suites that explicitly assert or mock `'gemini-3-flash-preview'` as the default text model.
- **Failure scenario:** Running `npm run test` will fail because `App.test.tsx`, `useModelSelection.test.ts`, and `ApiProviderContext.test.tsx` contain hardcoded assertions checking for `'gemini-3-flash-preview'`. Since the default model will change to `'gemini-3.5-flash'` in Phase 4, these tests will fail.
- **Evidence:** `__tests__/App.test.tsx:68`, `__tests__/contexts/ApiProviderContext.test.tsx:119`, and `__tests__/hooks/useModelSelection.test.ts:22` contain hardcoded `'gemini-3-flash-preview'` references.
- **Suggested fix:** Expand Phase 4/5 scope to explicitly include updating all mock contexts and test suites that check for the default text model ID.

---

## Finding 6: Global Client Contamination Breaking Video Features
- **Severity:** High
- **Location:** Phase 1 & 2, "Architecture" / validated scope decisions
- **Flaw:** The client instance `geminiClientInstance` in `apiClient.ts` is a global module singleton. When a user enables the Vertex Proxy, it modifies this global client instance to point to cliproxy. However, video generation features (`services/gemini/video.ts`) rely on `getGeminiClient()` and cannot be routed through cliproxy (since the proxy does not support video long-polling or the Veo models).
- **Failure scenario:** While Vertex Proxy is enabled, any attempt to generate scene suggestions, enhance descriptions, or generate video (which runs `getGeminiClient()`) will attempt to call the proxy URL `https://cliproxy.monet.uno`. This will result in 404/500 API errors and break the entire video studio.
- **Evidence:** `src/services/gemini/video.ts:13`, `74`, `121`, `188`, `286`, `356`, `403`, `534` show multiple calls to `getGeminiClient()`.
- **Suggested fix:** Create a separate `getDirectGeminiClient()` helper in `apiClient.ts` that always returns a direct, non-proxied GoogleGenAI instance. Update `video.ts` (and potentially other services that must bypass the proxy) to use `getDirectGeminiClient()`.

---

## Finding 7: Infinite Loop / Redundant Request Risk in Automatic Proxy Fallback Retry
- **Severity:** Medium
- **Location:** Phase 4, section "Implementation Steps" (step 6)
- **Flaw:** The plan proposes automatically retrying with `imagen-4.0-fast-generate-001` if the text-to-image request fails on quota or unsupported errors. However, if the requested model was already `imagen-4.0-fast-generate-001`, the catch block will retry with the exact same model, causing a redundant second call or potential infinite recursion depending on how the retry is wrapped.
- **Failure scenario:** A text-to-image request using `imagen-4.0-fast-generate-001` fails due to quota limits. The proxy catch block detects the error, triggers the automatic fallback, and sends the exact same request again with `imagen-4.0-fast-generate-001`, causing a duplicate API call that fails identically, increasing latency and wasting quota.
- **Evidence:** Phase 4 Overview: `proxy image generation automatically falls back to Imagen Fast` and Phase 4 Architecture: `quota/unsupported/proxy mismatch → automatically retry imagen-4.0-fast-generate-001`.
- **Suggested fix:** Only trigger the automatic fallback retry if the original model was NOT `imagen-4.0-fast-generate-001`. If it was already `imagen-4.0-fast-generate-001`, immediately throw the error.
