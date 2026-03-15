# CONCERNS

## 1. Runtime and documentation drift

- Root docs such as `ARCHITECTURE.md`, `CODEBASE.md`, `docs/system-architecture.md`, `docs/codebase-summary.md`, and `docs/code-standards.md` still describe AIVideoAuto-specific types, services, and routing that are not present in current runtime source.
- `repomix-output.xml` also contains older source snapshots and can mislead planning if treated as canonical.
- Any future planning that reads those files without checking live source will infer the wrong provider model.

## 2. Mixed architecture quality

- The repo contains both clean component-hook splits and large all-in-one components.
- `components/LookbookGenerator.tsx` + `hooks/useLookbookGenerator.ts` is the desired pattern.
- `components/VirtualTryOn.tsx` still contains prompt construction, request orchestration, state, and rendering in one file.
- This inconsistency raises maintenance cost and weakens codebase-wide conventions.

## 3. Duplicate or stale logic paths

- `hooks/useVirtualTryOn.ts` contains placeholder prompt output (`return \`...\`` and `const prompt = \`...\``) while the runtime UI in `components/VirtualTryOn.tsx` contains the real prompt logic.
- Tests exist for `hooks/useVirtualTryOn.ts`, but the live UI does not import that hook.
- This means the repo currently carries a tested hook path that is not the active runtime path.

## 4. Browser secrets and direct API usage

- All provider integrations run directly in the browser.
- API keys are injected into browser code and can also be persisted in `localStorage` by `contexts/ApiProviderContext.tsx`.
- This is operationally simple, but it means credential exposure risk is bounded by the browser environment rather than a backend proxy.

## 5. Logging and debug noise

- The codebase keeps many `console.warn` and `console.error` calls in runtime paths, which is reasonable for debugging.
- It also still contains some `console.log` usage in current source such as `contexts/GoogleDriveContext.tsx`, `components/AIEditor.tsx`, `components/modals/SettingsModal.tsx`, `services/debugService.ts`, and `utils/imageCache.ts`.
- Production build strips `console.log/debug/info`, but dev output and test output can still become noisy.

## 6. Source-of-truth ambiguity

- Current source lives in root folders (`components/`, `hooks/`, `contexts/`, `services/`, `utils/`), while `src/` contains only CSS.
- Repo readers that assume `src/` is the application root will search the wrong tree first.
- Several historical docs and artifacts make that ambiguity worse.

## 7. Test strategy imbalance

- Contexts, hooks, and services are well represented in tests.
- Direct component behavior is less covered.
- There is no end-to-end test layer for provider settings, Google Drive auth, gallery sync, or feature switching through `App.tsx`.

## 8. Integration assumptions around GIS

- `contexts/GoogleDriveContext.tsx` assumes the global `google.accounts.oauth2` object exists after the external GIS script loads.
- This is valid in the browser shell defined by `index.html`, but fragile in any environment that changes HTML ownership or script loading order.

## Unresolved Questions

- Should `hooks/useVirtualTryOn.ts` be made canonical again or deleted after migrating its tests to the actual runtime path?
- Should provider keys remain browser-managed, or should Gemini/Drive-sensitive operations move behind a server boundary?
- Which root documentation files are intended to stay authoritative once `.planning/codebase/` becomes the current map?
