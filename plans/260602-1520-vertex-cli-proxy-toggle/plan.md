---
title: "Vertex CLI Proxy Toggle"
description: "Route Gemini provider through cliproxy with @google/genai base URL toggle; no account JSON or server-side service-account proxy."
status: completed
priority: P2
branch: "main"
tags: [gemini, cliproxy, vertex-proxy, settings, image-generation]
blockedBy: []
blocks: []
created: "2026-06-02T08:21:24.243Z"
createdBy: "ck:plan"
source: skill
---

# Vertex CLI Proxy Toggle

## Overview

Add a Settings toggle that routes Gemini provider calls through `https://cliproxy.monet.uno` using the existing `@google/genai` SDK with `httpOptions.baseUrl` and `apiVersion: 'v1beta'`. This is **not** a Vertex AI account JSON plan and does **not** add a server-side service-account proxy. The user provides proxy URL + proxy API key in the app settings.

The key correction from the old draft: changing only the SDK base URL is not enough. `generateImageFromText()` currently uses `ai.models.generateImages()` (`src/services/gemini/image.ts:137`), while cliproxy is verified through Gemini-style `generateContent` for Imagen. Proxy-enabled image generation needs a service branch that uses `generateContent()` and parses `inlineData`.

## Validated scope decisions

- No account JSON.
- No server-side service-account proxy.
- No video work.
- Text generation selector should use exact Gemini 3+ model IDs, with `gemini-3.5-flash` as the default model choice and `gemini-3.1-pro` as the Pro text model.
- Replace the previous default `gemini-3-flash-preview` with exact model ID `gemini-3.5-flash`; replace any `gemini-3.1-pro-preview` reference with exact `gemini-3.1-pro`.
- No Gemini 2 text `thinkingBudget` clamp required; migrate actual stale defaults/helper literals in `gemini/text.ts` to exact model ID `gemini-3.5-flash` unless the caller explicitly passes another selected text model.
- Proxy image generation should prefer `imagen-4.0-fast-generate-001` when proxy is enabled because Ultra is quota-limited and Fast was tested OK.
- Image edit/model IDs must remain exact: `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview` are valid; `gemini-3.1-flash-image` is invalid and must not be introduced.

## Architecture

```text
SettingsModal → useSettingsModal → ApiProviderContext
                              ↓
                       setGeminiApiKey()
                       setGeminiBaseUrl()
                              ↓
                       getGeminiClient()
                              ↓
        direct path: Google Gemini API
        proxy path:  cliproxy /v1beta via httpOptions.baseUrl
```

### Runtime behavior

- Proxy disabled:
  - `getGeminiClient()` uses direct Google Gemini API.
  - `generateImageFromText()` may keep `ai.models.generateImages()`.
- Proxy enabled:
  - `getGeminiClient()` uses `apiVersion: 'v1beta'` + `httpOptions.baseUrl`.
  - `setGeminiApiKey(vertexProxyApiKey)` supplies the proxy key.
  - Proxy enabled/url/key persist in localStorage, matching existing provider-key behavior.
  - `generateImageFromText()` uses `ai.models.generateContent()` with `responseModalities: [Modality.IMAGE]`.
  - `numberOfImages` is handled by looping one generateContent request per requested image for reliability.
  - `imagen-4.0-fast-generate-001` is the automatic fallback only for documented quota errors (`429`/`RESOURCE_EXHAUSTED`) on non-Fast proxy image models.

## Phases

| Phase | Name | Status | Depends on |
|-------|------|--------|------------|
| 1 | [Proxy Client Wiring](./phase-01-proxy-client-wiring.md) | Completed | None |
| 2 | [Settings State and UI](./phase-02-settings-state-and-ui.md) | Completed | 1 |
| 3 | [Proxy Image Generation](./phase-03-proxy-image-generation.md) | Completed | 1, 2 |
| 4 | [Model Fallback Cleanup](./phase-04-model-fallback-cleanup.md) | Completed | 3 |
| 5 | [Tests and Verification](./phase-05-tests-and-verification.md) | Completed | 1, 2, 3, 4 |

## Primary files

### Modify

- `src/services/apiClient.ts`
- `src/contexts/ApiProviderContext.tsx`
- `src/hooks/useSettingsModal.ts`
- `src/components/modals/SettingsModal.tsx`
- `src/locales/en.ts`
- `src/locales/vi.ts`
- `src/services/gemini/image.ts`
- `src/services/gemini/text.ts` to remove Gemini 2 defaults and helper hardcodes; use default exact model ID `gemini-3.5-flash`
- `src/config/modelRegistry.ts` only if proxy-specific image fallback/default is represented in registry/config

### Tests

- `__tests__/services/apiClient.test.ts`
- `__tests__/contexts/ApiProviderContext.test.tsx`
- `__tests__/hooks/useSettingsModal.test.tsx`
- `__tests__/components/SettingsModal.test.tsx`
- `__tests__/services/gemini/image.test.ts`
- `__tests__/services/gemini/text.test.ts` for Gemini 3/3.1 defaults and helper model migration
- `__tests__/locales/key-parity.test.ts`

## Success criteria

- [ ] Settings has a Vertex Proxy toggle with URL + proxy API key fields.
- [ ] Proxy settings persist and rehydrate correctly.
- [ ] `apiClient.ts` can initialize `GoogleGenAI` with `apiVersion: 'v1beta'` and `httpOptions.baseUrl`.
- [ ] Proxy-enabled `generateImageFromText()` uses `generateContent()` and parses `inlineData`.
- [ ] Direct Gemini path remains backward-compatible.
- [ ] Existing image model IDs remain exact: `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview`; no `gemini-3.1-flash-image` typo/regression.
- [ ] Text model selector/defaults include `gemini-3.5-flash` as the default choice and `gemini-3.1-pro` as the Pro choice; no Gemini 2 text clamp is needed.
- [ ] Proxy image generation automatically falls back to `imagen-4.0-fast-generate-001` only for documented quota errors on non-Fast proxy image models.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, and `npm run build` pass.

## Risk assessment

| Risk | Level | Mitigation |
|---|---|---|
| Treating proxy as account JSON/server-side flow again | High | Plan explicitly bans account JSON and server-side proxy work |
| `generateImages()` still used under proxy | High | Add dedicated proxy-enabled `generateContent()` tests |
| Persisting proxy key in localStorage may be sensitive | Medium | User confirmed localStorage; match provider-key behavior and never print/store key in source |
| Direct Gemini flow regression | Medium | Test direct and proxy client construction branches |
| Imagen Ultra quota failures | Medium | Auto fallback to `imagen-4.0-fast-generate-001` only for documented quota errors on non-Fast proxy models and report fallback clearly |

## Resolved policy decisions

- Proxy API key persists in localStorage.
- Imagen quota fallback is automatic to `imagen-4.0-fast-generate-001` only for documented quota errors (`429`/`RESOURCE_EXHAUSTED`) on non-Fast proxy image models.
- Remaining Gemini 2 hardcoded helpers in `gemini/text.ts` migrate to Gemini 3/3.1 in this scope.
- Proxy `numberOfImages` loops one `generateContent()` request per output image for reliability.

## Open questions

None.

## Red Team Review

### Session — 2026-06-02
**Findings:** 14 (14 accepted, 0 rejected)
**Severity breakdown:** 4 Critical, 6 High, 4 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Lack of Initial Sync of Proxy Settings on App Boot / Page Refresh | Critical | Accept | Phase 2 |
| 2 | Type-Level Compilation Error via Invalid `numberOfImages` inside `ImageConfig` | Critical | Accept | Phase 3 |
| 3 | Race Condition and Multiple Re-renders via Un-grouped State Setters | High | Accept | Phase 2 |
| 4 | Text Helper and Analyze Scene API Failures via Hardcoded `thinkingConfig` on Flash Models | Critical | Accept | Phase 4 |
| 5 | Stale Default Text Model Assertions causing Test Failures | Medium | Accept | Phase 5 |
| 6 | Global Client Contamination Breaking Video Features | High | Accept | Phase 1 & 2 |
| 7 | Infinite Loop / Redundant Request Risk in Automatic Proxy Fallback Retry | Medium | Accept | Phase 4 |
| 8 | Plaintext Client-Side Storage of Sensitive API Credentials | High | Accept (modified) | Phase 2 |
| 9 | Mixed Content Blocking and API Key Exposure over Insecure HTTP | High | Accept | Phase 2 |
| 10 | Client SSRF / Cross-Origin Intrusions via Restored Configurations | Medium | Accept | Phase 2 |
| 11 | Lack of Client-Side Generation Timeout Leading to Resource Exhaustion | Medium | Accept | Phase 3 |
| 12 | Typo and Mismatch in Text Generation Default and Registry Models | High | Accept | Phase 4 |
| 13 | Safety Checks Failure inside Proxy Image Generation | High | Accept | Phase 3 |
| 14 | Ignored Model Parameter in Text Service Facade | Medium | Accept | Phase 4 |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-proxy-client-wiring.md, phase-02-settings-state-and-ui.md, phase-03-proxy-image-generation.md, phase-04-model-fallback-cleanup.md, phase-05-tests-and-verification.md
- Decision deltas checked: 14
- Reconciled stale references: 14
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-06-02
**Trigger:** Slash command /ck:plan validate on Vertex CLI Proxy Toggle plan
**Questions asked:** 4

#### Questions & Answers

1. **[Bảo mật]** Mức độ hiển thị cảnh báo lưu API Key thô (localStorage) trên giao diện người dùng nên là gì?
   - Options: (Recommended) Hiển thị dòng chú thích cảnh báo màu vàng nổi bật bên dưới trường nhập API Key để khuyên dùng trên máy cá nhân | Chỉ hiển thị dưới dạng biểu tượng Tooltip nhỏ bên cạnh tiêu đề nhập API Key | Chỉ ghi chú trong tài liệu mã nguồn (code comments), không hiển thị cảnh báo trên giao diện người dùng
   - **Answer:** (Recommended) Hiển thị dòng chú thích cảnh báo màu vàng nổi bật bên dưới trường nhập API Key để khuyên dùng trên máy cá nhân
   - **Rationale:** Clear warning notice in the UI protects user credentials on shared or public devices.

2. **[Hiệu năng]** Thời gian timeout tối đa cho các request ảnh gửi qua Proxy nên được cấu hình là bao nhiêu?
   - Options: (Recommended) 30 giây (phù hợp với các dịch vụ proxy chuẩn, hạn chế tối đa việc treo UI) | 60 giây (dành nhiều thời gian hơn phòng khi cliproxy phản hồi chậm dưới tải cao) | Không đặt timeout, để mặc định của trình duyệt (khoảng 2 phút)
   - **Answer:** (Recommended) 30 giây (phù hợp với các dịch vụ proxy chuẩn, hạn chế tối đa việc treo UI)
   - **Rationale:** Keeps application responsive and avoids long-running stalled connection states.

3. **[Trải nghiệm]** Khi hệ thống tự động fallback sang model Imagen Fast do lỗi quota, có nên hiển thị thông báo cho người dùng biết không?
   - Options: (Recommended) Có, hiển thị Toast cảnh báo dạng warning thông báo hệ thống tự động đổi sang model Imagen Fast do model chính bị hết hạn ngạch (quota) | Không, tự động chạy ngầm và không hiển thị thông báo để giữ trải nghiệm liền mạch | Hiển thị một Modal bắt buộc người dùng nhấn xác nhận trước khi tiếp tục với model Imagen Fast
   - **Answer:** (Recommended) Có, hiển thị Toast cảnh báo dạng warning thông báo hệ thống tự động đổi sang model Imagen Fast do model chính bị hết hạn ngạch (quota)
   - **Rationale:** Informs users when their preferred model was swapped due to API limits.

4. **[Độ tin cậy]** Nếu cấu hình proxy trong localStorage bị phát hiện không hợp lệ lúc khởi động (ví dụ URL HTTP công cộng), hệ thống nên xử lý thế nào?
   - Options: (Recommended) Silent fail-closed: Tự động chạy chế độ trực tiếp (direct Google API) và ghi log console lỗi, không thông báo Toast để tránh phiền nhiễu khi khởi động | Hiển thị Toast thông báo lỗi cấu hình Proxy ngay khi ứng dụng khởi động thành công | Chặn không cho ứng dụng khởi động (hiển thị Error boundary cứng)
   - **Answer:** Hiển thị Toast thông báo lỗi cấu hình Proxy ngay khi ứng dụng khởi động thành công
   - **Rationale:** Provides active notification at startup if the proxy config is invalid, so developers or users can address it immediately.

#### Confirmed Decisions
- UI Warn Notice: Show prominent yellow notice below input warning about plaintext localStorage.
- Timeout Duration: Set a 30s AbortSignal timeout on proxy-enabled image requests.
- Fallback Notification: Show warning toast when auto fallback to Fast model triggers.
- Startup Validation Error: Show alert toast if rehydrated proxy configuration is invalid.

#### Action Items
- [ ] Add yellow warning text below API key field in SettingsModal component.
- [ ] Implement 30s AbortSignal wrapper in proxy image service request.
- [ ] Implement warning toast alert on image model fallback.
- [ ] Add startup validation check in ApiProviderContext mount effect, showing toast if configuration fails validation.

#### Impact on Phases
- Phase 2: Add UI yellow warning text, startup check toast, and validation logic.
- Phase 3: Add 30s AbortSignal timeout to proxy image requests.
- Phase 4: Add warning toast alert on fallback trigger in image service.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-proxy-client-wiring.md, phase-02-settings-state-and-ui.md, phase-03-proxy-image-generation.md, phase-04-model-fallback-cleanup.md, phase-05-tests-and-verification.md
- Decision deltas checked: 4
- Reconciled stale references: 4
- Unresolved contradictions: 0
