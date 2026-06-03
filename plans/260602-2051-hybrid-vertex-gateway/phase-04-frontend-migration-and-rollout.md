# Phase 04 — Frontend Migration and Rollout

## Context links
- Current proxy settings state: `src/contexts/ApiProviderContext.tsx:16-20`, `src/contexts/ApiProviderContext.tsx:89-103`, `src/contexts/ApiProviderContext.tsx:206-244`
- Current Gemini client base URL switch: `src/services/apiClient.ts:118-187`
- Current image facade used by hooks: `src/services/imageEditingService.ts:14-101`, `src/services/imageEditingService.ts:109-247`
- Current proxy-mode image branch: `src/services/gemini/image.ts:197-239`
- Provider studios are isolated and must not be routed through Gemini facade: `docs/product/provider-studios.md:53-70`, `docs/product/provider-studios.md:105-113`

## Overview
- Priority: P1
- Status: pending
- Brief: move incrementally. Preserve current app behavior while switching one path at a time from browser-side proxying to the new backend.

## Key insights
- The safest short-term migration is not a rewrite. It is a staged swap under the existing `vertexProxySettings` abstraction.
- The Gemini studio should migrate first. Grok/GPT Image studios stay isolated.
- `imageEditingService.ts` is the right seam because many hooks already depend on it rather than calling Gemini services directly.

## Requirements
### Functional
- Keep existing UI toggle working during transition.
- Support two migration modes:
  1. Compatibility mode: current client points to hosted gateway `/gemini`
  2. Workload mode: selected features call `/api/images/*`
- Add rollout flags so each workflow can move independently.
- New Vite env vars must use the `VITE_` prefix unless explicitly injected in `vite.config.ts`.

### Non-functional
- No big-bang release.
- Rollback within one deploy/config flip.
- Preserve existing provider-studio isolation.

## Architecture
### Short-term migration
1. Replace ad-hoc external proxy URL default with hosted service URL that includes the `/gemini` suffix for SDK compatibility.
2. Keep `vertexProxySettings.enabled/url/apiKey` shape temporarily so UI churn stays low (`src/contexts/ApiProviderContext.tsx:16-20`).
3. Route Gemini-compatible calls to the new backend first; no hook rewrites yet.
4. Move image generation to custom `/api/images/generate` where response normalization is simpler.
5. Move edit/upscale/describe workloads next through `imageEditingService.ts`.

### Long-term target
- Browser no longer knows arbitrary external proxy URLs.
- `vertexProxySettings` becomes gateway settings or a server-mode selector.
- Gemini-compatible shared gateway serves multiple clients, not only this SPA.
- Custom endpoints become the preferred contract for app-owned workflows; compatibility routes remain for cross-client reuse and debugging.

### Workflow sequencing
- Step 1: deploy backend dark.
- Step 2: switch `configureGeminiClient()` base URL to hosted gateway `/gemini` for opt-in users (`src/services/apiClient.ts:118-183`).
- Step 3: move `generateImageFromText()` traffic from compatibility route to `/api/images/generate` behind a feature flag.
- Step 4: move `editImage()`/`upscaleImage()` through backend-backed facade in `imageEditingService.ts`.
- Step 5: remove arbitrary proxy host entry from settings; keep only gateway enable + key if product still needs user-supplied key.

## Related code files
### Existing files to modify in this phase
- `src/contexts/ApiProviderContext.tsx`
- `src/services/apiClient.ts`
- `src/services/gemini/image.ts`
- `src/services/imageEditingService.ts`
- `src/hooks/useSettingsModal.ts`
- `src/components/modals/SettingsModal.tsx`
- `src/locales/en.ts`
- `src/locales/vi.ts`
- tests covering these files
- `__tests__/contexts/ApiProviderContext.test.tsx`
- `__tests__/services/apiClient.test.ts`
- `__tests__/services/gemini/image.test.ts`
- `__tests__/services/imageEditingService.test.ts`
- `__tests__/components/ui-boundary-imports.test.ts`
- provider-isolation tests to prove `src/services/providers/*` remains untouched

### New backend/docs files touched
- `gateway/README.md` or backend docs equivalent if requested later
- deploy/config docs for rollout flags

### Files explicitly out of scope
- Provider studio services under `src/services/providers/*`

## Implementation steps
1. Add Vite env/feature flags for hosted gateway URL and per-workflow migration toggles: `VITE_GATEWAY_BASE_URL`, `VITE_GATEWAY_ENABLE_COMPAT`, `VITE_GATEWAY_ENABLE_IMAGE_GENERATE`, `VITE_GATEWAY_ENABLE_IMAGE_EDIT`, `VITE_GATEWAY_ENABLE_IMAGE_UPSCALE`.
2. Keep `ApiProviderContext` schema stable initially; repoint default URL to the hosted `/gemini` backend URL.
3. Add tests proving `configureGeminiClient()` receives the `/gemini` base URL and still supports direct Gemini fallback.
4. Add backend-aware path in `imageEditingService.ts` so hook callers stay unchanged.
5. Migrate image generation first, then edit/upscale, then helper/describe flows.
6. After production confidence, simplify settings UI and remove arbitrary third-party proxy host entry.
7. Update docs and test matrix per rollout stage.

## Todo list
- [ ] Add rollout flags
- [ ] Repoint default proxy URL to hosted gateway `/gemini`
- [ ] Add base URL and fallback tests
- [ ] Migrate generate path behind feature flag
- [ ] Migrate edit/upscale paths behind feature flags
- [ ] Simplify settings after stabilization
- [ ] Update docs and smoke tests

## Success criteria
- Existing hooks continue working without signature changes.
- At least one Gemini workflow uses the backend in production behind a reversible flag.
- Rollback can restore previous direct/proxy client behavior without code deletion.
- Provider studios remain untouched and isolated.
- Typecheck, lint, tests, and Vite production bundle validation pass after frontend migration changes.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---|
| Mixing provider-studio traffic into gateway migration | Low | High | Explicitly keep `src/services/providers/*` out of scope |
| Frontend flag sprawl becomes untestable | Medium | Medium | one env flag per workflow family, not per component |
| Settings UX confusion during transition | High | Medium | keep old shape first, simplify only after backend stable |
| Hidden blast radius across many hook callers | Medium | High | migrate at `imageEditingService.ts` seam instead of every hook |
| Saved arbitrary proxy URL bypasses hosted gateway assumptions | Medium | Medium | keep stable restore short-term, add validation warnings, then migrate storage keys in cleanup |
| Browser gateway key persists as a shared localStorage secret | Medium | High | scope key to gateway auth, support rotation/rate limits, and remove user-supplied key UX after stabilization |

## Security considerations
- Prefer platform-managed gateway key/env over storing raw Google keys in browser.
- If temporary browser gateway key persists, keep existing warning posture and scope it only to gateway auth, not Google auth.
- Do not allow arbitrary external proxy hosts long-term.
- Do not label the gateway key as a Google key in UI/i18n; copy must make the boundary explicit.

## Backwards compatibility
- Short-term: current `vertexProxySettings` stays readable; existing localStorage restores still work.
- Medium-term: default hosted gateway URL replaces generic proxy host.
- Long-term: migrate storage keys if UI contract changes; add one-time migration shim.

## Test matrix
- Unit: settings state migration, base URL selection, gateway feature flag resolver.
- Integration: image generation through backend-backed facade.
- Boundary: component service import test and provider isolation tests.
- E2E: toggle on hosted gateway, run one generate and one edit flow.
- Production: Vite bundle plus a smoke call path against deployed gateway config before removing direct fallback.

## Rollback plan
- Turn off backend feature flags.
- Revert hosted gateway default URL.
- Keep current direct Gemini path as fallback until backend proves stable.

## Next steps
- After rollout, plan a cleanup phase removing arbitrary proxy URL input and any no-longer-needed direct proxy branches.

## Unresolved questions
- None.
