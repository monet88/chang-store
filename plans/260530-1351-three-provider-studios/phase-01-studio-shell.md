---
phase: 1
title: "Studio Shell"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Studio Shell

## Overview

Add a header-level three-segment studio switcher and route the app into Gemini (default), Grok, or GPT Image mode. Gemini opens immediately — no launcher gate. Switching studios unmounts the previous and mounts the new one. Sidebar content swaps to show provider-relevant features.

## Requirements

- Functional: Gemini is the default studio — app opens directly into current Gemini workspace.
- Functional: Three-segment switch in header area allows switching between Gemini, Grok, GPT Image.
- Functional: Switching unmounts the previous studio and mounts the new one (no state preservation).
- Functional: Sidebar shows 5 provider features (Try-On, Lookbook, Clothing Transfer, Pattern Generator, AI Editor) when in Grok/GPT mode, 9 Gemini features when in Gemini mode.
- Functional: UtilityDock hides Gallery button when in Grok/GPT mode; Settings and PromptLibrary remain.
- Non-functional: Existing Gemini navigation, model selector, and feature rendering stay unchanged inside Gemini mode.
- Non-functional: No new React Context. Studio mode is simple `useState` in App/AppShell.

## Architecture

Studio mode state lives INSIDE `AppContent` (below all providers in the tree). Provider studios render their own complete content area — they do NOT share Gemini's workspace header, featureMeta, or GlobalModelSelector.

```text
App providers (LanguageProvider → ToastProvider → ApiProvider → ... → ImageViewerProvider)
  → AppContent (useState<StudioMode>('gemini'), activeFeature clamped on switch)
      → Header with StudioModeSwitch (three-segment)
      → if gemini: existing workspace header (featureMeta + GlobalModelSelector) + renderActiveFeature()
      → if grok: GrokStudio (own content area, no Gemini workspace header)
      → if gptImage: GptImageStudio (own content area, no Gemini workspace header)
```

Key state contract:

```ts
type StudioMode = 'gemini' | 'grok' | 'gptImage';

// Supported features for provider studios (subset of Feature enum)
const PROVIDER_SUPPORTED_FEATURES: Feature[] = [
  Feature.TryOn,
  Feature.Lookbook,
  Feature.ClothingTransfer,
  Feature.PatternGenerator,
  Feature.AIEditor,
];
```

No `sessionStates` map. No `StudioLauncher`. Unmount/remount on switch. On switch to provider mode, clamp `activeFeature` to first supported feature if current is Gemini-only.

## Related Code Files

- Modify: `src/App.tsx`
- Modify: `src/types.ts` (add `StudioMode` type, `PROVIDER_SUPPORTED_FEATURES`)
- Modify: `src/components/Header.tsx` (add `studioMode` prop, swap sidebar content based on studio mode)
- Modify: `src/components/Tabs.tsx` (add optional `studioMode?: StudioMode` prop; provider mode renders 5 features in single flat group)
- Modify: `src/components/UtilityDock.tsx` (add `studioMode?: StudioMode` prop for conditional GalleryButton)
- Modify: `src/locales/en.ts`
- Modify: `src/locales/vi.ts`
- Modify: `vite.config.ts` (add provider env vars to `define` block with non-prefixed hosting name + VITE_ fallback; fix misleading comment)
- Create: `src/components/studios/StudioModeSwitch.tsx`
- Test: `__tests__/components/studios/StudioModeSwitch.test.tsx`

## Implementation Steps

1. Add `StudioMode` type and `PROVIDER_SUPPORTED_FEATURES` constant to `src/types.ts`.
2. Inject provider env vars in `vite.config.ts` `define` block using NON-prefixed hosting names with VITE_ fallback (matching Gemini pattern): `'process.env.GROK_API_KEY': JSON.stringify(env.GROK_API_KEY || env.VITE_GROK_API_KEY)`, same for `GROK_BASE_URL`, `GPT_IMAGE_API_KEY`, `GPT_IMAGE_BASE_URL`. Fix misleading comment at line 41 — replace with accurate statement: "API keys injected in all build modes and exposed in client bundle. Plan proxy for v2."
3. Create `StudioModeSwitch` — three-segment control with Gemini/Grok/GPT labels.
4. Add `useState<StudioMode>('gemini')` INSIDE `AppContent` (below all providers). Do NOT insert a wrapper above the provider stack.
5. On studio switch: clamp `activeFeature` to `PROVIDER_SUPPORTED_FEATURES[0]` if current `activeFeature` is not in `PROVIDER_SUPPORTED_FEATURES`. This prevents Gemini-only features (Background, Pose, PhotoAlbum, WatermarkRemover) from leaking into provider mode.
6. Conditionally render entire `<main>` content area based on `studioMode`: Gemini → existing workspace header (featureMeta, GlobalModelSelector) + `renderActiveFeature()`; Grok/GPT → provider studio component renders its own complete content area (no Gemini workspace header, no GlobalModelSelector).
7. Pass `studioMode` to `Header` (new prop in `HeaderProps`). Header passes it down to `Tabs` and `UtilityDock`.
8. Add optional `studioMode?: StudioMode` prop to `Tabs`. When `'grok'` or `'gptImage'`, render 5 `PROVIDER_SUPPORTED_FEATURES` in a single flat group. When `'gemini'` or `undefined`, render existing 3 groups.
9. Pass `studioMode?: StudioMode` to `UtilityDock`. Conditional: `{(!studioMode || studioMode === 'gemini') && <GalleryButton ... />}`. Settings and PromptLibrary remain visible in all modes.
10. Place `StudioModeSwitch` in header area, visible in all modes.
11. Add i18n keys: `studio.switch.label`, `studio.switch.gemini`, `studio.switch.grok`, `studio.switch.gptImage`.

## Success Criteria

- [ ] App opens directly into Gemini workspace (no launcher page).
- [ ] Header shows three-segment switch with Gemini selected by default.
- [ ] Clicking Grok/GPT unmounts Gemini and shows placeholder.
- [ ] Switching back to Gemini restores full Gemini experience.
- [ ] Sidebar content changes based on studio mode.
- [ ] Gallery button hidden in UtilityDock for non-Gemini studios.
- [ ] Existing Gemini `activeFeature` session behavior remains scoped to Gemini branch.

## Risk Assessment

- Risk: Touching `src/App.tsx` can regress existing layout.
  - Mitigation: Keep `AppContent` logic intact; add studioMode state inside it, not above providers.
- Risk: Header/sidebar changes can break mobile navigation.
  - Mitigation: Test mobile overlay behavior after adding studio mode prop.
- Risk: i18n missing keys break labels.
  - Mitigation: Add `en.ts` and `vi.ts` together in same step.
- Risk: `activeFeature` session persistence restores Gemini-only feature in provider mode.
  - Mitigation: Clamp `activeFeature` to `PROVIDER_SUPPORTED_FEATURES[0]` on studio switch if current feature not in subset.
- Risk: featureMeta/GlobalModelSelector bleeds into provider studios.
  - Mitigation: Provider studios render own complete `<main>` content area; Gemini workspace header only renders when `studioMode === 'gemini'`.

<!-- Updated: Validation Session 1 — Added vite.config.ts to modified files, Tabs studioMode prop, UtilityDock conditional Gallery, detailed implementation steps -->
<!-- Updated: Red Team Session — activeFeature clamp on switch, architecture placement inside AppContent below providers, featureMeta conditional render, env var naming pattern, vite.config.ts comment fix, UtilityDock prop specified as studioMode -->

