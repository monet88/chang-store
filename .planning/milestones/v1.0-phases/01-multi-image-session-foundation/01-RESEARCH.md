# Phase 1: Multi-Image Session Foundation - Research

**Researched:** 2026-03-16
**Domain:** React 19 + TypeScript feature modularization for a multi-image Upscale workflow
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use a lightweight thumbnail rail for the session image picker instead of large image cards.
- Each image in the picker should show light status only: clear active-image indication plus at most a small state badge.
- Keep the main output area as a sticky right-side panel on desktop rather than moving the result below the controls.
- When a user uploads a new image into the session, make the newest upload the active image immediately.
- Put Quick Upscale and AI Studio behind a segmented top switch inside Upscale instead of sending the user to another feature or a heavy side-nav split.
- Preserve the shared session images and each mode's in-progress draft state when switching between Quick Upscale and AI Studio.
- Keep Quick Upscale one switch away while the user is in AI Studio; do not duplicate Quick Upscale actions inside every AI Studio step by default.
- Use one shared session result panel for the active image instead of separate output areas for Quick Upscale and AI Studio.
- Show a visible step header/progress treatment for AI Studio so users can always see the guided path.
- Use hybrid forward movement: auto-advance after successful actions when natural, but always allow moving back or returning to prior steps.
- Show upcoming AI Studio steps in a disabled state before they unlock, rather than hiding the whole path.
- If a user changes an earlier step, keep later outputs visible until the user reruns them; do not silently wipe downstream work.

### Claude's Discretion
- Exact mobile adaptation of the workspace while preserving the sticky-right-panel intent on desktop.
- Exact wording and iconography for session-image badges, step labels, and mode-switch labels.
- Whether the thumbnail rail sits above the form controls or just below the mode switch, as long as active-image selection stays obvious.
- Exact warning treatment for "output may need regeneration" when users backtrack in AI Studio.

### Deferred Ideas (OUT OF SCOPE)
- None. Phase 1 stays on shell, session state, navigation, and mode coexistence only.
</user_constraints>

<research_summary>
## Summary

Phase 1 should not introduce new runtime infrastructure. The repo already has the right primitives: a thin-feature pattern in `docs/code-standards.md`, reusable upload and output components, shared provider/model resolution in `contexts/ApiProviderContext.tsx`, and existing session image storage in `contexts/ImageGalleryContext.tsx`. The correct move is to refactor `components/Upscale.tsx` from a one-file utility into a thin screen backed by a dedicated `useUpscale` hook and a small set of focused presentational children under `components/upscale/`.

The standard implementation pattern for this codebase is local feature orchestration, not a new global store. Multi-image session state, active-image selection, Quick Upscale draft state, and AI Studio shell progression should stay feature-local inside `useUpscale`. Shared logic already solved elsewhere should be reused rather than rebuilt: `ImageUploader` for image intake, gallery selection modal for pulling existing images, `ImageComparator` for the shared result panel, and localized error handling through `getErrorMessage(err, t)`.

Key planning recommendation: treat Phase 1 as a foundation-only refactor plus shell build. Do not pull AI Studio analysis, prompt generation, provider gating, or preview simulation forward. The phase should leave the codebase with a multi-image session model, a stable mode switch, a visible step shell, and test coverage that locks in session-preservation behavior for later phases.

**Primary recommendation:** Build Phase 1 as one vertical slice centered on `useUpscale` plus modular UI children, with no new state library and no provider logic leaking into presentational components.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.3 | Feature component composition and local state | Already the app runtime and the repo standard for feature orchestration |
| typescript | 5.8.3 | Strict feature and state modeling | Existing repo standard with shared types in `types.ts` |
| vite | 6.4.1 | SPA build/dev pipeline | Existing app toolchain; no phase-specific replacement needed |
| vitest | 4.0.17 | Hook and component regression coverage | Already configured with jsdom and coverage thresholds |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 | Render and interaction tests | For `useUpscale` consumers and shell behavior checks |
| lodash-es | 4.17.23 | Debounce/helper utilities | Only if state persistence or draft throttling becomes necessary |
| tailwindcss | 4.1.18 | Feature shell styling | Reuse existing utility-class design language for the workspace |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Feature-local hook state | Zustand or another global store | Extra infrastructure for state that does not need app-wide ownership |
| Reusing `ImageUploader` + gallery modal | Custom multi-upload subsystem | More code, duplicate compression/gallery behavior, higher bug risk |
| Thin screen + child components | Expanding `components/Upscale.tsx` in place | Faster short-term, but conflicts with repo modularization rules and phase growth |

**Installation:**
```bash
# No new packages recommended for Phase 1
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```text
components/
├── Upscale.tsx
└── upscale/
    ├── UpscaleModeSwitch.tsx
    ├── UpscaleSessionImageRail.tsx
    ├── UpscaleQuickPanel.tsx
    ├── UpscaleStudioStepShell.tsx
    └── UpscaleOutputPanel.tsx
hooks/
└── useUpscale.ts
__tests__/
├── components/
│   └── Upscale.test.tsx
└── hooks/
    └── useUpscale.test.tsx
```

### Pattern 1: Thin Feature Screen + Feature Hook
**What:** Keep `components/Upscale.tsx` as a coordinator that binds localized strings, hook outputs, and presentational children.
**When to use:** Any feature growing past a simple single-form flow.
**Example:**
```typescript
export const useFeatureName = () => {
  const { t } = useLanguage();
  const { getModelsForFeature } = useApi();

  return {
    state,
    actions,
    viewModel,
  };
};

const FeatureName: React.FC = () => {
  const { state, actions, viewModel } = useFeatureName();
  return <FeatureWorkspace state={state} actions={actions} viewModel={viewModel} />;
};
```

### Pattern 2: Feature-Local Session Model With Per-Image State
**What:** Store one session array plus an active-image pointer, and keep mode-specific outputs keyed by the session image.
**When to use:** Multi-image flows where the user moves between items without losing work.
**Example:**
```typescript
interface UpscaleSessionImage {
  id: string;
  image: ImageFile;
  quickResult: ImageFile | null;
  aiStudio: {
    step: UpscaleStudioStep;
    completedSteps: UpscaleStudioStep[];
  };
}
```

### Pattern 3: Shared Output Panel, Separate Control Lanes
**What:** Preserve one sticky result panel while letting Quick Upscale and AI Studio swap only the left-side controls.
**When to use:** Hybrid workflows with a shared asset/result target.
**Example:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  <UpscaleControlColumn mode={mode} />
  <UpscaleOutputPanel activeImage={activeImage} result={activeResult} />
</div>
```

### Anti-Patterns to Avoid
- **Single giant `Upscale.tsx`:** Phase 1 is the last safe point to split the feature before later phases add more state and service paths.
- **Mode switch that resets state:** This violates the phase contract and will force later phases to rework user trust and continuity.
- **Provider checks inside UI branches:** Keep provider/model resolution in hook/service code, not spread across child components.
- **Hidden future steps:** The context explicitly requires disabled upcoming steps to stay visible.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session image upload + compression | New drag/drop/compression pipeline | `components/ImageUploader.tsx` | Existing component already handles upload, preview, compression, and gallery selection |
| Gallery-backed image picking | Custom modal/gallery picker | `components/modals/ImageSelectionModal.tsx` | Existing modal already integrates with `ImageGalleryContext` |
| Global feature state store | New context/store for Upscale session | `hooks/useUpscale.ts` local state | Phase 1 state is feature-scoped, not app-global |
| Result compare UI | New compare widget | `components/ImageComparator.tsx` | Current compare surface already fits Quick Upscale output needs |

**Key insight:** Phase 1 is mostly an orchestration refactor. The risk is not missing a library; it is reimplementing behaviors that the repo already has in reusable pieces.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Shared Session State Gets Overwritten By Active Image Changes
**What goes wrong:** Switching the active image clears prior result/draft data or leaks one image's state into another.
**Why it happens:** State is modeled as one set of feature fields instead of per-image records.
**How to avoid:** Make the session image the unit of storage. Keep Quick Upscale result and AI Studio shell state attached to each session item.
**Warning signs:** Changing the active image replaces the output panel with another image's draft or resets mode-specific controls.

### Pitfall 2: Mode Switch Becomes A Hard Reset
**What goes wrong:** Switching between Quick Upscale and AI Studio discards in-progress state.
**Why it happens:** The mode flag is coupled to initialization side effects or reset handlers.
**How to avoid:** Treat mode as view selection only. Reset only on explicit start-over or image removal.
**Warning signs:** Quality selection, AI Studio step progress, or active result disappears after changing mode.

### Pitfall 3: Later-Step Outputs Are Silently Wiped
**What goes wrong:** Going back to an earlier AI Studio step deletes downstream outputs immediately.
**Why it happens:** Step changes are implemented as destructive state resets.
**How to avoid:** Keep downstream outputs visible and mark them stale instead of deleting them. Force rerun only when the user chooses to continue.
**Warning signs:** Back navigation instantly removes prior prompt/result content without user action.

### Pitfall 4: Phase 1 Accidentally Pulls In Later-Phase Logic
**What goes wrong:** The foundation plan starts adding Gemini analysis, prompt generation, unsupported-provider messaging, or preview simulation.
**Why it happens:** The shell build and later AI Studio behaviors are not separated cleanly.
**How to avoid:** Phase 1 only delivers shell, session model, active-image behavior, and step navigation scaffolding.
**Warning signs:** New services or prompts appear in the plan that are tied to Phase 3 or Phase 4 requirements.
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from the current repo:

### Feature Hook Split
```typescript
// Source: docs/code-standards.md
export const useFeatureName = () => {
  const [input, setInput] = useState<ImageFile | null>(null);
  const [results, setResults] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return { input, setInput, results, isLoading, error };
};
```

### Memoized Presentational Component
```typescript
// Source: components/ImageUploader.tsx
const ImageUploader: React.FC<ImageUploaderProps> = React.memo(({ image, onImageUpload, title, id }) => {
  const preview = useMemo(
    () => (image ? `data:${image.mimeType};base64,${image.base64}` : null),
    [image?.base64, image?.mimeType]
  );

  const processFile = useCallback(async (file: File) => {
    // upload/compression logic
  }, [onImageUpload]);
});
```

### Sticky Output Panel Pattern
```tsx
// Source: components/LookbookOutput.tsx + components/Upscale.tsx
<div className="sticky top-8">
  <div className="relative w-full min-h-[50vh] rounded-2xl border border-zinc-800">
    <ResultPlaceholder description={t('upscale.outputPanelDescription')} />
  </div>
</div>
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic feature screen | Thin coordinator + hook + memoized children | Current repo standard | Better maintainability and safer phase-by-phase expansion |
| One-image utility flows | Session-aware per-item state | Needed for multi-step AI features | Prevents state leaks and supports active-image switching |
| Global store by default | Localized hook state until ownership widens | Current React app practice | Lower complexity for feature-scoped workflows |

**New tools/patterns to consider:**
- Feature-local state records keyed by image id: needed once one screen owns multiple working images.
- Shared output panel with segmented control lanes: fits the repo's two-column workspace pattern and the phase context.

**Deprecated/outdated:**
- Expanding `components/Upscale.tsx` as the only implementation file: this is incompatible with the repo's modularization rules and the planned scope of later phases.
</sota_updates>

<open_questions>
## Open Questions

1. **Should shared Upscale session types live in `types.ts` or stay local to the hook?**
   - What we know: repo standards use `types.ts` for shared domain types, but feature-local details can stay in the hook/module.
   - What's unclear: how many of the Phase 1 session types will be reused outside Upscale children.
   - Recommendation: put cross-component contracts in `types.ts`, keep purely internal reducer/helper types local to `useUpscale.ts`.

2. **Should session image ids be index-based or generated identifiers?**
   - What we know: active-image switching and per-image result storage need stable identity across removal/reordering.
   - What's unclear: whether Phase 1 will support reordering immediately or only append/select/remove behavior.
   - Recommendation: use generated ids from the start; it prevents index-coupling bugs when the rail grows later.
</open_questions>

<validation_architecture>
## Validation Architecture

Phase 1 already has the test infrastructure it needs. The most effective strategy is a fast hook-focused regression pass after each task, then a broader feature/build check after the full plan.

- **Primary automated target:** `__tests__/hooks/useUpscale.test.tsx`
- **Secondary automated target:** `__tests__/components/Upscale.test.tsx`
- **Quick command:** `npm run test -- useUpscale`
- **Feature render command:** `npm run test -- Upscale`
- **Full suite command:** `npm run test`
- **Build gate:** `npm run build`

Validation should prove four behaviors:
- Multiple uploaded session images remain available in one feature session.
- The newest uploaded image becomes active automatically.
- Quick Upscale and AI Studio preserve mode-specific draft state across switching.
- AI Studio keeps visible, disabled future steps and allows back-navigation without silently clearing later outputs.
</validation_architecture>

<sources>
## Sources

### Primary (HIGH confidence)
- `F:\CodeBase\Chang-Store\docs\code-standards.md` - feature/hook separation, testing conventions, memoization patterns
- `F:\CodeBase\Chang-Store\docs\system-architecture.md` - provider hierarchy, service routing, feature-local ownership
- `F:\CodeBase\Chang-Store\.planning\PROJECT.md` - current milestone decisions and scope boundaries
- `F:\CodeBase\Chang-Store\.planning\ROADMAP.md` - phase goal, requirements, and success criteria
- `F:\CodeBase\Chang-Store\.planning\phases\01-multi-image-session-foundation\01-CONTEXT.md` - locked decisions for shell behavior
- `F:\CodeBase\Chang-Store\components\Upscale.tsx` - current feature baseline
- `F:\CodeBase\Chang-Store\components\ImageUploader.tsx` - reusable intake pattern
- `F:\CodeBase\Chang-Store\components\LookbookOutput.tsx` - sticky output and segmented output shell pattern

### Secondary (MEDIUM confidence)
- `F:\CodeBase\Chang-Store\contexts\ApiProviderContext.tsx` - current feature-specific model override behavior
- `F:\CodeBase\Chang-Store\contexts\ImageGalleryContext.tsx` - image-session storage and gallery reuse behavior
- `F:\CodeBase\Chang-Store\services\imageEditingService.ts` - existing quick-upscale integration path
- `F:\CodeBase\Chang-Store\vitest.config.ts` - current testing framework and coverage baseline

### Tertiary (LOW confidence - needs validation)
- None. Research stayed inside current repo guidance and code paths.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: React 19 + TypeScript feature modularization
- Ecosystem: existing provider, gallery, uploader, and result-panel primitives
- Patterns: thin screen + hook, per-image session state, shared output panel
- Pitfalls: state resets, phase-scope drift, UI/provider coupling

**Confidence breakdown:**
- Standard stack: HIGH - derived from `package.json`, repo docs, and current test config
- Architecture: HIGH - aligned with repo architecture docs and current source files
- Pitfalls: HIGH - directly inferred from phase constraints and current monolithic baseline
- Code examples: HIGH - taken from current project docs/components

**Research date:** 2026-03-16
**Valid until:** 2026-04-15
</metadata>

---

*Phase: 01-multi-image-session-foundation*
*Research completed: 2026-03-16*
*Ready for planning: yes*
