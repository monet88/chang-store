# Milestone Roadmap: v1.5 Multi-Person Selective Try-On

**2 phases** | **6 requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 12 | Multi-Person Marker UI | Build the toggle and canvas interface securely without touching backend APIs. | TRYON-01, TRYON-02, TRYON-03 | 3 |
| 13 | Engine Orchestration | Inject the marker data natively into the Gemini sequence and prompt logic. | TRYON-04, TRYON-05, TRYON-06 | 3 |

## Phase Details

**Phase 12: Multi-Person Marker UI**
**Goal:** Build the interactive canvas UI toggle to drop and clear visual markers without affecting the existing backend APIs.
**Requirements:** TRYON-01, TRYON-02, TRYON-03
**Success criteria:**
1. A "Multi-person" UI toggle successfully appears in Virtual Try-On configuration layout.
2. Clicking on the subject image while the toggle is active places a red dot marker properly rendered.
3. The created marker can be easily cleared/reset via user interactions.

**Phase 13: Engine Orchestration**
**Goal:** Append the visual marker coordinate logic into an offscreen canvas composite, and inject the instructions efficiently into Gemini execution.
**Requirements:** TRYON-04, TRYON-05, TRYON-06
**Success criteria:**
1. Image compounding automatically places the selected dot against the image's binary blob in a memory-safe manner.
2. The Gemini prompt enforces the rule to ONLY modify the targeted entity carrying the distinct dot.
3. Fallback behaves completely cleanly as it always has if the toggle isn't switched on.
