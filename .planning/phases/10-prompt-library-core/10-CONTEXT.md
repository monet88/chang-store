# Phase 10: Prompt Library Core - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the prompt library data layer, hook, localStorage persistence, curated presets, and the modal/drawer UI with search and CRUD operations.

</domain>

<decisions>
## Implementation Decisions

### Data Storage & Limits
- UUID via `crypto.randomUUID()`
- Yes, cap at 50 to prevent `localStorage` issues
- Newest first (by `createdAt` timestamp)
- Allow it, but generate new ID

### Prompt Library UI & FAB
- Fixed bottom-right corner
- Bottom drawer on mobile, centered modal on desktop (matches `GalleryModal`)
- Standard browser `confirm()` to avoid building complex UI
- "Curated" badge beside the 3 presets

### Search & UX
- Simple case-insensitive string matching (`.includes`)
- Yes, toast message "Prompt saved"
- No, out of scope for v1.4

### the agent's Discretion
None

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Shared components in `src/components/shared/` and modal structures in `src/components/modals/`.
- `useLanguage` for i18n from `src/contexts/LanguageContext.tsx`.

### Established Patterns
- State management via custom hooks.
- Modals implemented consistently with Tailwind UI patterns.
- Persistent data stored in `localStorage` inside context/hooks.

### Integration Points
- `src/App.tsx` or layout shell for FAB injection.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
