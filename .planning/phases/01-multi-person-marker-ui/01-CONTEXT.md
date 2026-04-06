# Phase 12: Multi-Person Marker UI - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the interactive canvas UI toggle to drop and clear visual markers on the subject image without affecting the existing backend APIs. Delivers TRYON-01 (toggle), TRYON-02 (place marker), and TRYON-03 (clear marker). No Gemini or prompt changes in this phase — pure UI state + overlay.

</domain>

<decisions>
## Implementation Decisions

### Toggle UI Design
- Placed inside the Step 1 panel, below the subject image uploader — stays close to what it controls
- Amber pill toggle style, consistent with existing toggle components in BackgroundReplacer/Relight
- Label: "Multi-person mode" — simple, matches REQUIREMENTS TRYON-01 terminology
- Visible but dimmed when inactive — users can discover and enable without confusion

### Marker Canvas Interaction
- Overlay canvas with absolute positioning on top of the `<img>` element — lightweight, avoids the full three-canvas complexity of `useCanvasDrawing`
- Marker: red filled circle ~24px with white border — high contrast, classic pin metaphor
- Single click always replaces marker — one marker max, newest position wins
- onClick handler (works for both mouse and touch tap) — simplest cross-device approach

### Clear/Reset UX
- "Clear marker" button appears below the subject image when a marker is set — explicit action
- Toggling mode OFF automatically clears any existing marker
- Uploading new subject images automatically clears the marker (stale marker = confusing)
- All state (isMultiPersonMode, markerPosition) lives in `useVirtualTryOn` hook — follows existing pattern

### Agent's Discretion
- Canvas overlay z-index and pointer-events management (ensure overlay doesn't block image drag/upload)
- Exact pixel size of marker circle may vary slightly based on visual testing
- Whether to expose markerPosition as `{ x: number; y: number; relativeX: number; relativeY: number }` (relative coords reserved for Phase 13 engine use)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useVirtualTryOn.ts` — extends this hook with new state fields: `isMultiPersonMode`, `markerPosition`, `setIsMultiPersonMode`, `clearMarker`
- `src/components/VirtualTryOn.tsx` — thin component to add toggle + overlay canvas; pattern already established
- `useCanvasDrawing.ts` — reference for canvas cleanup patterns (unmount cleanup); do NOT reuse directly — simpler approach needed
- `ImageUploader.tsx` — subject image area wrapper; overlay will sit adjacent to the existing MultiImageUploader

### Established Patterns
- State in hook, UI in component — mandatory per AGENTS.md
- Tailwind dark glassmorphism for UI elements
- `const { t } = useLanguage()` for all user-facing strings
- Error pattern: `try/catch/finally` with `getErrorMessage(err, t)`
- Toggle uses amber coloring (primary accent color)

### Integration Points
- `useVirtualTryOn.ts` — add `isMultiPersonMode: boolean`, `markerPosition: { x: number; y: number } | null`, `setIsMultiPersonMode`, `clearMarker` to state and return
- `VirtualTryOn.tsx` — add toggle row and canvas overlay in Step 1 panel
- `src/locales/en.ts` + `vi.ts` — add keys under `virtualTryOn` namespace for toggle label and clear button
- Phase 13 will consume `markerPosition` from the hook — keep the API stable

</code_context>

<specifics>
## Specific Ideas

- Marker position should store relative coordinates (0–1 range, normalized to image dimensions) in addition to pixel coordinates, so Phase 13 can use them without additional calculation
- The overlay canvas/div sits on top of the currently-displayed subject image preview; only the first/selected subject is targeted (batch multi-person is out of scope for v1.5)
- The "Clear marker" button should use the same ghost/danger-hover style as the existing "Clear subjects" button for visual consistency

</specifics>

<deferred>
## Deferred Ideas

- Support for placing multiple markers (multiple targets in one image) — deferred to a future milestone
- Extending the marker paradigm to Relight or Lookbook features — noted in REQUIREMENTS as future scope
- High-fidelity lasso or bounding box selection — explicitly out of scope per REQUIREMENTS

</deferred>
