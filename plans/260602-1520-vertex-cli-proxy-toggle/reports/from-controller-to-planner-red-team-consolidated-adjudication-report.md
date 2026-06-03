# Red Team Consolidated Adjudication Report: Vertex CLI Proxy Toggle
**Controller:** Antigravity (Architect / Planner)
**Date:** 2026-06-02
**Plan Path:** `plans/260602-1520-vertex-cli-proxy-toggle/`

---

## Executive Summary

A red-team adversarial review was conducted by spawning three parallel reviewer subagents:
1. **Security Adversary (Fact Checker)**
2. **Assumption Destroyer (Scope Auditor)**
3. **Failure Mode Analyst (Flow Tracer)**

A total of **14 distinct findings** were identified and evaluated. All 14 findings contained concrete codebase evidence (file:line citations) and passed the evidence filter. The proposed disposition for all findings is **Accept** (with minor modification for local storage security).

---

## Adjudicated Findings

### Finding 1: Lack of Initial Sync of Proxy Settings on App Boot / Page Refresh
- **Severity:** Critical
- **Reviewers:** Assumption Destroyer, Security Adversary, Failure Mode Analyst
- **Location:** Phase 2, section "Overview" and "Implementation Steps"
- **Flaw:** Proxy state is loaded from localStorage into React state on mount, but never synced to the `apiClient` singleton module-level variables. Page refresh causes subsequent Gemini calls to silently bypass the proxy and hit the direct Google API.
- **Evidence:** `src/contexts/ApiProviderContext.tsx:75`
- **Disposition:** Accept
- **Rationale:** Prevents a major functional and security bypass where configured proxy settings are ignored after a page reload until settings are re-saved.
- **Suggested Fix:** Add a mount `useEffect` in `ApiProviderContext.tsx` to apply proxy settings to `apiClient` setters: `setGeminiBaseUrl(vertexProxyEnabled ? vertexProxyUrl : null)` and `setGeminiApiKey(vertexProxyEnabled ? vertexProxyApiKey : null)`.

### Finding 2: Type-Level Compilation Error via Invalid `numberOfImages` inside `ImageConfig`
- **Severity:** Critical
- **Reviewer:** Assumption Destroyer
- **Location:** Phase 3, section "Architecture"
- **Flaw:** Proposed `generateContent` request structure passes `numberOfImages: 1` inside the `imageConfig` object, which is not supported by the `@google/genai` SDK's `ImageConfig` interface.
- **Evidence:** types file `node_modules/@google/genai/dist/node/node.d.ts` (ImageConfig struct does not contain `numberOfImages`).
- **Disposition:** Accept
- **Rationale:** Direct TypeScript compilation block.
- **Suggested Fix:** Remove `numberOfImages: 1` from the `imageConfig` object. The looping logic already requests one image at a time.

### Finding 3: Race Condition and Multiple Re-renders via Un-grouped State Setters
- **Severity:** High
- **Reviewer:** Assumption Destroyer
- **Location:** Phase 2, section "Requirements" and "Implementation Steps"
- **Flaw:** The plan proposes three independent state variables (`vertexProxyEnabled`, `vertexProxyUrl`, `vertexProxyApiKey`), which can cause multiple re-renders or intermediate mismatched config states during a save transaction.
- **Evidence:** `src/contexts/ApiProviderContext.tsx:94-105` (shows the grouped `providerSettings` pattern).
- **Disposition:** Accept
- **Rationale:** Aligning with the existing grouped state design pattern simplifies React rendering state transitions and ensures atomic configuration changes.
- **Suggested Fix:** Group proxy settings into a single `vertexProxySettings` object state: `{ enabled: boolean, url: string, apiKey: string }`.

### Finding 4: Text Helper and Analyze Scene API Failures via Hardcoded `thinkingConfig` on Flash Models
- **Severity:** Critical
- **Reviewers:** Assumption Destroyer, Failure Mode Analyst
- **Location:** Phase 4, section "Requirements" and "Implementation Steps"
- **Flaw:** Standard models like `gemini-3.5-flash` do not support thinking configurations. However, text services currently lock `thinkingConfig: { thinkingBudget: 32768 }` into the request object.
- **Evidence:** `src/services/gemini/text.ts:13-15`, `219-221`, `278-280`
- **Disposition:** Accept
- **Rationale:** Using `gemini-3.5-flash` with a hardcoded `thinkingBudget` triggers API validation errors (HTTP 400), completely crashing all text helpers.
- **Suggested Fix:** Conditionally omit `thinkingConfig` inside `generateText()`, `generateStylePromptFromImage()`, and `analyzeScene()` when standard Flash models are selected.

### Finding 5: Stale Default Text Model Assertions causing Test Failures
- **Severity:** Medium
- **Reviewers:** Assumption Destroyer, Security Adversary
- **Location:** Phase 5, section "Test Plan"
- **Flaw:** Changing the default text model to `gemini-3.5-flash` will break multiple test files that explicitly assert that the default text model is `gemini-3-flash-preview`.
- **Evidence:** Hardcoded `'gemini-3-flash-preview'` assertions found in `__tests__/App.test.tsx:68`, `__tests__/components/SettingsModal.test.tsx:48`, `__tests__/contexts/ApiProviderContext.test.tsx:119`, and `__tests__/hooks/useModelSelection.test.ts:22`.
- **Disposition:** Accept
- **Rationale:** Necessary to keep the test suite green.
- **Suggested Fix:** Expand Phase 4/5 scope to update all mock contexts and assertions referencing `'gemini-3-flash-preview'` to `'gemini-3.5-flash'`.

### Finding 6: Global Client Contamination Breaking Video Features
- **Severity:** High
- **Reviewers:** Assumption Destroyer, Security Adversary, Failure Mode Analyst
- **Location:** Phase 1 & 2, "Architecture" / validated scope decisions
- **Flaw:** Modifying the global singleton client instance `geminiClientInstance` in `apiClient.ts` redirects all client calls to the proxy. However, video generation features in `services/gemini/video.ts` are not supported by the proxy.
- **Evidence:** `src/services/gemini/video.ts:13` calls `getGeminiClient()`.
- **Disposition:** Accept
- **Rationale:** Prevents proxy settings from breaking the non-proxied video studio.
- **Suggested Fix:** Introduce `getDirectGeminiClient()` in `apiClient.ts` that always returns a direct client, and update `video.ts` to use it.

### Finding 7: Infinite Loop / Redundant Request Risk in Automatic Proxy Fallback Retry
- **Severity:** Medium
- **Reviewers:** Assumption Destroyer, Failure Mode Analyst
- **Location:** Phase 4, section "Implementation Steps" (step 6)
- **Flaw:** Proxy image generation automatically falls back to `imagen-4.0-fast-generate-001` on quota/unsupported errors. However, if the requested model was already `imagen-4.0-fast-generate-001`, this triggers a redundant duplicate request that will fail identically.
- **Evidence:** Phase 4 Overview and Architecture.
- **Disposition:** Accept
- **Rationale:** Avoids redundant network calls and quota waste.
- **Suggested Fix:** Only retry with fallback model if the original model was NOT `imagen-4.0-fast-generate-001`.

### Finding 8: Plaintext Client-Side Storage of Sensitive API Credentials
- **Severity:** High
- **Reviewer:** Security Adversary
- **Location:** Phase 2, section "Requirements" and "Implementation Steps"
- **Flaw:** Storing the `vertexProxyApiKey` in plain, unencrypted browser `localStorage` allows potential key exfiltration via XSS attacks.
- **Evidence:** `src/contexts/ApiProviderContext.tsx:98`
- **Disposition:** Accept (modified)
- **Rationale:** Valid security risk. However, full client-side encryption is security-by-obscurity since the frontend SPA executes in user-space. We will modify the fix: we will persist settings in `localStorage` to match existing provider behavior, but we will add explicit comments in the code and include a tooltip/notice in the Settings UI warning users about the risks of storing keys in shared or public browsers.

### Finding 9: Mixed Content Blocking and API Key Exposure over Insecure HTTP
- **Severity:** High
- **Reviewer:** Security Adversary
- **Location:** Phase 2, section "Requirements" and "Implementation Steps"
- **Flaw:** Allowing public custom HTTP proxy URLs causes Mixed Content blocking in HTTPS production deployments and transmits credentials in plain text.
- **Evidence:** `src/utils/provider-url-validation.ts:97-99`
- **Disposition:** Accept
- **Rationale:** Ensures transport security for proxy credentials.
- **Suggested Fix:** Enforce `validateProviderBaseUrl` checks in the Settings modal when saving proxy configurations. Allow `http:` only for loopback/private addresses.

### Finding 10: Client SSRF / Cross-Origin Intrusions via Restored Configurations
- **Severity:** Medium
- **Reviewer:** Security Adversary
- **Location:** Phase 2, "Implementation Steps" and `src/hooks/useSettingsModal.ts`
- **Flaw:** Settings restore functionality parses backup files and sets `vertexProxyUrl` directly without sanitizing the target domain.
- **Evidence:** `src/hooks/useSettingsModal.ts:177`
- **Disposition:** Accept
- **Rationale:** Prevents malicious JSON backups from routing local proxy requests to internal cross-origin targets.
- **Suggested Fix:** Apply `validateProviderBaseUrl` on any restored proxy URL before writing to localStorage.

### Finding 11: Lack of Client-Side Generation Timeout Leading to Resource Exhaustion
- **Severity:** Medium
- **Reviewer:** Security Adversary
- **Location:** Phase 3, "Architecture"
- **Flaw:** Looping proxy requests in parallel with `Promise.all` without an abort signal or timeout can allow a stalled proxy to hang the UI indefinitely.
- **Evidence:** `src/services/gemini/image.ts:124-125`
- **Disposition:** Accept
- **Rationale:** Enhances UI resilience against unresponsive proxies.
- **Suggested Fix:** Add a standard timeout helper (e.g. 30-second abort signal) to proxy-enabled image requests.

### Finding 12: Typo and Mismatch in Text Generation Default and Registry Models
- **Severity:** High
- **Reviewer:** Security Adversary, Failure Mode Analyst
- **Location:** Phase 4, "Requirements"
- **Flaw:** The plan proposes replacing `gemini-2.5-flash` with `gemini-3.5-flash` in helpers, but helpers in `text.ts` are actually hardcoded to `gemini-3-flash`.
- **Evidence:** `src/services/gemini/text.ts` lines 64, 113, and 161.
- **Disposition:** Accept
- **Rationale:** Fixes invalid find-and-replace scopes in the plan.
- **Suggested Fix:** Update the plan to target `'gemini-3-flash'` as the search target for helper model migration.

### Finding 13: Safety Checks Failure inside Proxy Image Generation
- **Severity:** High
- **Reviewer:** Failure Mode Analyst
- **Location:** Phase 3, section "Implementation Steps"
- **Flaw:** Proxy image generation parses `inlineData` from candidates directly without validating `finishReason`. When safety filters block generation, `parts` is empty, leading to a `TypeError` runtime crash.
- **Evidence:** `src/services/gemini/image.ts:134-161`
- **Disposition:** Accept
- **Rationale:** Ensures safety blocks return clean errors (`error.api.safetyBlock`) instead of breaking the UI.
- **Suggested Fix:** Check `response.promptFeedback?.blockReason` or candidate `finishReason` before parsing `inlineData`.

### Finding 14: Ignored Model Parameter in Text Service Facade
- **Severity:** Medium
- **Reviewer:** Failure Mode Analyst
- **Location:** `src/services/textService.ts`
- **Flaw:** Text helper services receive a `model` parameter from the UI/hook layer but ignore it when calling the underlying Gemini text service helpers.
- **Evidence:** `src/services/textService.ts` lines 84, 118, and 152.
- **Disposition:** Accept
- **Rationale:** Ensures user-selected model settings are correctly propagated down to helper prompts.
- **Suggested Fix:** Update helper functions in `src/services/textService.ts` to pass the `model` parameter to `geminiTextService`.
