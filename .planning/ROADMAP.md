# Roadmap: v1.4 Prompt Library

## Phase 10: Prompt Library Core

**Goal:** Build the prompt library data layer, hook, localStorage persistence, curated presets, and the modal/drawer UI with search and CRUD operations.

**Requirements:** PLIB-01, PLIB-02, PLIB-03, PLIB-05, PLIB-06, PLIB-07, PLIB-08

**Success Criteria:**
1. User can open a FAB that launches a modal showing all saved prompts
2. User sees 3 curated preset prompts on first use without any prior interaction
3. User can search/filter prompts by keyword and results update live
4. User can save a new prompt with a title and delete existing prompts
5. Prompts persist in localStorage and survive browser refresh

---

## Phase 11: Feature Integration

**Goal:** Wire the prompt library's "insert" action into all feature screens that have prompt input fields, enabling one-tap prompt insertion from the library.

**Requirements:** PLIB-04

**Success Criteria:**
1. User can select a prompt from the library and it fills the active feature's prompt input
2. Insert works correctly in Virtual Try-On, Clothing Transfer, Lookbook, and any other feature with prompt input
3. Modal closes after selection and prompt is ready to use
4. Existing prompt input behavior is not disrupted when library is not used

---

## Summary

| # | Phase | Goal | Requirements | Criteria |
|---|-------|------|--------------|----------|
| 10 | Prompt Library Core | Data layer, UI, presets, CRUD, persistence | Complete    | 2026-04-02 |
| 11 | Feature Integration | Wire insert into all feature prompt inputs | PLIB-04 | 4 |

**Total:** 2 phases | 8 requirements mapped | 100% coverage ✓
