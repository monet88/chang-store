# Phase 1: Multi-Image Session Foundation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the self-contained Upscale shell for a Gemini-only multi-image session. Users stay inside the Upscale feature, keep multiple uploaded images available in one session, choose an active image at any time, move through internal AI Studio steps without leaving the screen, and keep Quick Upscale available in the same session. This phase defines the shell, navigation, and state behavior only; the deeper AI Studio analysis/prompt features arrive in later phases.

</domain>

<decisions>
## Implementation Decisions

### Session workspace
- Use a lightweight thumbnail rail for the session image picker instead of large image cards.
- Each image in the picker should show light status only: clear active-image indication plus at most a small state badge.
- Keep the main output area as a sticky right-side panel on desktop rather than moving the result below the controls.
- When a user uploads a new image into the session, make the newest upload the active image immediately.

### Quick Upscale and AI Studio coexistence
- Put Quick Upscale and AI Studio behind a segmented top switch inside Upscale instead of sending the user to another feature or a heavy side-nav split.
- Preserve the shared session images and each mode's in-progress draft state when switching between Quick Upscale and AI Studio.
- Keep Quick Upscale one switch away while the user is in AI Studio; do not duplicate Quick Upscale actions inside every AI Studio step by default.
- Use one shared session result panel for the active image instead of separate output areas for Quick Upscale and AI Studio.

### AI Studio flow behavior
- Show a visible step header/progress treatment for AI Studio so users can always see the guided path.
- Use hybrid forward movement: auto-advance after successful actions when natural, but always allow moving back or returning to prior steps.
- Show upcoming AI Studio steps in a disabled state before they unlock, rather than hiding the whole path.
- If a user changes an earlier step, keep later outputs visible until the user reruns them; do not silently wipe downstream work.

### Claude's Discretion
- Exact mobile adaptation of the workspace while preserving the sticky-right-panel intent on desktop.
- Exact wording and iconography for session-image badges, step labels, and mode-switch labels.
- Whether the thumbnail rail sits above the form controls or just below the mode switch, as long as active-image selection stays obvious.
- Exact warning treatment for "output may need regeneration" when users backtrack in AI Studio.

</decisions>

<specifics>
## Specific Ideas

- Keep the current Upscale feature feeling like a two-column workspace rather than turning Phase 1 into a gallery-heavy redesign.
- Favor continuity with existing in-app patterns: segmented mode switching, sticky output presentation, and internal guided steps.
- Prior milestone decisions still apply: AI Studio remains Gemini-only, the whole workflow stays inside Upscale, and Quick Upscale remains available as a fast lane in the same feature session.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/Upscale.tsx`: current two-column Upscale screen already has the feature entry point, quality controls, and sticky comparison panel that Phase 1 should evolve rather than replace from scratch.
- `components/ImageUploader.tsx`: existing upload surface already handles drag/drop, compression, and gallery selection; it can be reused for adding images into the session.
- `components/modals/ImageSelectionModal.tsx`: existing gallery picker supports selecting prior images and can inform session-image intake behavior.
- `components/ImageComparator.tsx`: existing before/after comparison widget can stay as the Quick Upscale result view inside the shared output panel.
- `components/OutfitAnalysis.tsx`: existing step-based in-feature flow provides a concrete pattern for AI Studio step state, back navigation, and staged progression.
- `components/LookbookOutput.tsx`: existing segmented/tabbed output shell provides a reference for top-level mode switching and sticky right-side output behavior.
- `contexts/ImageGalleryContext.tsx`: app-level gallery state already handles image objects and image reuse, though Phase 1 session state itself should stay scoped to Upscale.

### Established Patterns
- Feature work should follow the repo's preferred split: thin component, hook-owned orchestration, shared service facade, localized UI strings.
- Provider/model access belongs in `useApi().getModelsForFeature(Feature.Upscale)` and `services/imageEditingService.ts`, not in duplicated UI logic.
- User-facing errors should continue to flow through `getErrorMessage(err, t)` and localized translation keys.
- New strings must be added in both `locales/en.ts` and `locales/vi.ts`.

### Integration Points
- `App.tsx` already lazy-loads `components/Upscale.tsx`, so the Phase 1 shell should stay inside the existing feature route.
- `types.ts` is the right place for any shared Upscale session or step-state domain types that need to be reused across component/hook boundaries.
- `services/imageEditingService.ts` remains the Quick Upscale service entry point while later phases add AI Studio-specific service calls around it.
- `contexts/ImageGalleryContext.tsx` and existing gallery-driven UI let the feature reuse images from the wider app without moving the whole workflow outside Upscale.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-multi-image-session-foundation*
*Context gathered: 2026-03-16*
