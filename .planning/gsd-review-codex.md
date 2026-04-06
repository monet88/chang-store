# Plan Review: Phase 01 Multi-Person Marker UI

## Plan 12.01: Multi-Person Hook State Extension

### Summary
This is the strongest of the three plans. It stays inside the approved phase boundary, keeps business logic in the hook where the project expects it, and establishes the minimum state contract needed for the UI work in the next plan. The main gap is that it defines storage shape and clearing behavior, but not the hook API for placing/updating the marker, which Plan 12.02 will need in order to avoid leaking interaction logic into the component.

### Strengths
- Cleanly aligned with the project architecture: state in hook, UI in component.
- Scope is controlled and phase-appropriate: no backend or prompt changes.
- The auto-clear rules are well chosen and reduce stale-state bugs.
- Normalized coordinates are a good forward-compatible decision for the next phase.
- Explicit export requirements reduce the chance of partial implementation.

### Concerns
- `MEDIUM`: The plan omits a dedicated `setMarkerPosition` or `placeMarker` handler, so Plan 12.02 may be forced to compute and mutate marker state inside the component, which conflicts with the "thin UI wrapper" rule.
- `MEDIUM`: Storing both pixel and normalized coordinates in hook state may create drift if the image is resized after placement. For this phase, rendering should ideally derive pixels from normalized coords at render time.
- `LOW`: It says "uploading new subject images clears the marker" but does not mention whether toggling mode on should preserve `null` safely across pre-existing images.
- `LOW`: No explicit note about type reuse or whether a dedicated marker type should be added to avoid anonymous object spread across files.

### Suggestions
- Add a hook handler such as `placeMarker({ relX, relY })` or `setMarkerPosition(...)` so click-to-marker logic remains in the hook.
- Prefer storing only normalized coordinates in state unless pixel coordinates are truly required elsewhere.
- Specify whether `handleSubjectImagesUpload` should also force `isMultiPersonMode` off or only clear the marker. Based on the stated decisions, only clearing the marker is safer.
- Define and export a named marker type to keep the contract stable across hook and component.

### Risk Assessment
**LOW**. This plan is appropriately scoped and structurally sound. The missing placement handler is the main design gap, but it is straightforward to correct without expanding scope.

---

## Plan 12.02: Multi-Person UI - Toggle, Overlay, Clear

### Summary
This is the right companion to Plan 12.01 and is directionally correct for the phase goals, but it is underspecified. It names the UI surfaces to add, but it does not define enough behavior to guarantee a clean implementation without business logic leaking into the component. As written, it is a decent high-level execution note, not yet a strong implementation plan.

### Strengths
- Correct dependency ordering: it assumes hook state comes first.
- Stays within the intended UI-only scope.
- Keeps state ownership in the hook instead of the component.
- Includes i18n updates, which are easy to miss and required in this codebase.
- Matches the chosen UX decisions: toggle, overlay, clear action.

### Concerns
- `MEDIUM`: The plan does not specify how marker placement coordinates are computed and handed to the hook.
- `MEDIUM`: It does not mention responsive behavior when the image is scaled, which matters for marker accuracy.
- `MEDIUM`: It does not define touch/click event handling enough to prevent accidental placement outside the rendered image bounds.
- `LOW`: It does not specify empty/loading/error states, though this is a relatively small UI addition.
- `LOW`: It does not say whether the clear button is conditional on both `isMultiPersonMode` and existing marker, or just marker existence.

### Suggestions
- Add explicit implementation notes for coordinate calculation relative to the rendered image box.
- Define that marker placement should clamp to image bounds.
- Specify whether the overlay is mounted only when `isMultiPersonMode` is enabled and an image exists.
- Clarify clear-button visibility logic: it should appear only when a marker exists.
- Explicitly state that the component should not own marker state or placement business rules beyond converting click position into normalized coordinates.

### Risk Assessment
**MEDIUM**. The plan is correct in intent, but it lacks enough operational detail to ensure the implementation stays clean and bug-resistant, especially around overlay positioning and event handling.

---

## Plan 01.03: Phase 01 Gap Closure

### Summary
This plan is the weakest and should not be accepted as part of Phase 01 in its current form. It goes beyond "gap closure" and materially changes the approved UI design by altering image-list behavior, layout structure, and image-management UX. Some of its goals may be valid as fixes if a prototype exposed real issues, but as written it introduces scope creep, conflicts with the earlier design decisions, and risks pushing component-level logic into a phase that was supposed to remain a lightweight overlay enhancement.

### Strengths
- It identifies real classes of UI risk: pointer interception, preview sizing, and overlay anchoring.
- It tries to make marker placement more precise and reduce accidental blocking.
- It explicitly ties the overlay to a narrower wrapper instead of a broad container, which is a sound direction if interception bugs were observed.

### Concerns
- `HIGH`: Restricting the input list to only the first image is a product behavior change, not a simple UAT fix. It alters the uploader model and may conflict with existing try-on assumptions.
- `HIGH`: Hiding `MultiImageUploader` and replacing it with a large single-image presentation is a significant layout redesign, not a small phase-boundary adjustment.
- `HIGH`: Adding dedicated "Remove Image" / "Change Image" controls expands scope into uploader UX, which was not part of TRYON-01/02/03.
- `MEDIUM`: It contradicts the earlier decision that the canvas overlay should be lightweight and sit over the existing `<img>` element. This plan effectively restructures the preview flow.
- `MEDIUM`: "Attach `id=\"multi-person-overlay\"` exactly to this new single image wrapper" sounds implementation-specific in a brittle way; IDs should not drive layout architecture unless there is a clear consuming dependency.
- `LOW`: The marker size change from ~24px to 16px may improve precision but directly conflicts with the approved visual design without justification from accessibility or usability evidence.

### Suggestions
- Split this into two buckets: actual defect fixes for overlay hit-testing versus product/layout redesign. Only the first belongs in this phase.
- Keep the existing uploader visible unless there is a documented requirement change; fix pointer interception with wrapper boundaries and `pointer-events` instead of replacing the preview model.
- Do not change multi-image behavior in Phase 01 unless the requirement explicitly says multi-person mode only supports one subject image.
- Treat "Remove Image" / "Change Image" as a separate follow-up plan if needed.
- If marker precision is a concern, validate size through UX testing rather than changing the approved marker spec ad hoc.

### Risk Assessment
**HIGH**. This plan is not just patching gaps; it changes product behavior and layout significantly. It risks missing the phase goal by broadening the work and introducing new UX decisions that have not been approved.

---

## Overall Assessment

The best path is:

1. Approve `12.01` with one correction: add a hook-level marker placement API.
2. Approve `12.02` after adding concrete overlay/coordinate behavior notes.
3. Reject or heavily trim `01.03` so it only addresses true overlay hit-testing defects, not uploader/layout redesign.

The combined plan set achieves the phase goals only if execution stays centered on `12.01 + 12.02`. `01.03` in its current form is the main source of delivery risk because it expands the feature from "toggle + place + clear marker" into a broader preview and uploader rework.
