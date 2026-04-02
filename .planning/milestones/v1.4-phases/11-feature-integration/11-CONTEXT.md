# Phase 11: Feature Integration - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the prompt library's "insert" action into all feature screens that have prompt input fields, enabling one-tap prompt insertion from the library.

</domain>

<decisions>
## Implementation Decisions

### Insertion Architecture
- Dispatch a Custom Event (`window.dispatchEvent(new CustomEvent('prompt-inserted', {detail}))`) — lightweight, avoids prop-drilling or context overhaul.
- In the UI components (`useEffect` mapping to `setPrompt` / `onChangeText`) — keeps hooks pure and stateless regarding native DOM events.

### Insertion UX & Coverage
- Replace completely — ensures the inserted preset is clean and avoids contradictory instructions.
- All features with prompt inputs (Virtual Try-On, Lookbook, Clothing Transfer, Pose, Watermark, AIEditor, RefinementInput).
- Modal closes & Toast notification ("Prompt applied") is shown.
- No — just insert the text and allow the user to review it before further typing.

### the agent's Discretion
None.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PromptLibraryModal.tsx` exists with an `onSelect` prop ready to handle insertion logic.
- Hook standard `useVirtualTryOn`, `useLookbookGenerator`, etc., all manage their own UI state for prompts.

### Established Patterns
- Modals wrap UI updates via `Toast` elements.
- Feature components maintain UI state via hook returns.

### Integration Points
- `PromptLibraryModal.tsx` to dispatch event.
- Every major feature component `.tsx` will include the custom event listener logic (`window.addEventListener('prompt-inserted', handler)`).

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
