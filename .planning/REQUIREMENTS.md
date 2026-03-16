# Requirements: Chang-Store

**Defined:** 2026-03-16  
**Core Value:** Users can turn fashion reference images into production-ready visual assets quickly, with predictable quality and minimal manual tool-hopping.

## v1 Requirements

### Workflow

- [ ] **UPS-01**: User can upload multiple fashion lookbook images and keep them available inside the Upscale feature during one session
- [ ] **UPS-02**: User can keep using a direct in-app `Quick Upscale` flow with 2K or 4K selection and before/after comparison
- [ ] **UPS-03**: User can move through the `AI Studio` steps inside the Upscale feature without leaving the screen or switching to another feature
- [ ] **UPS-04**: User can run `AI Studio` without losing access to the `Quick Upscale` lane in the same feature screen
- [ ] **UPS-05**: User can select any uploaded image in the current Upscale session as the active image for `Quick Upscale` or `AI Studio`
- [ ] **UPS-06**: User can run `Quick Upscale` with the locked preservation-first prompt pattern adapted to the selected 2K or 4K target
- [ ] **UPS-07**: User can trigger Upscale immediately after `AI Studio` generates the prompt for the active image

### Analysis

- [ ] **ANL-01**: User can generate a structured analysis of the uploaded image covering model presentation, garments, materials, background, lighting, framing, and pose
- [ ] **ANL-02**: User can see preservation-risk notes for detail-sensitive areas such as text, logos, jewelry, embroidery, skin, and fabric texture

### Prompt Package

- [ ] **PRM-01**: User can receive one copy-ready English master prompt generated from the active image and analysis for the Gemini workflow available in the app
- [ ] **PRM-02**: User can receive Gemini-oriented prompt guidance that prioritizes faithful upscale and detail preservation rather than creative restyling
- [ ] **PRM-03**: Each uploaded image can keep its own AI Studio-generated upscale prompt, and the inline Upscale action uses the matching prompt for that image

### Preview

- [ ] **PRV-01**: User can read a simulated description of how the upscaled result is likely to improve in sharpness, texture, color, and lighting
- [ ] **PRV-02**: User can clearly see that the simulated preview is advisory text, not guaranteed output

### Guidance

- [ ] **GDE-01**: User can view Gemini-specific execution steps for using the generated prompt and report inside the supported Gemini workflow
- [ ] **GDE-02**: User can see a recommended Gemini-first next action based on the uploaded image and analysis

### Reliability

- [ ] **REL-01**: User sees clear feature-scoped error messaging when the configured provider or model is not supported for the Gemini-only AI Studio report

## v2 Requirements

### Workflow Expansion

- **PRM-04**: User can choose between faithful upscale and creative restyling prompt modes
- **GDE-03**: User can export the full AI Studio report as a reusable brief document

## Out of Scope

| Feature | Reason |
|---------|--------|
| Midjourney, Krea, Leonardo, Topaz, Make, or Zapier support | User clarified the milestone should stay Gemini-only |
| Moving the guided pipeline into other feature screens | User clarified the full experience must stay inside Upscale |
| Fake AI-generated preview image for the simulated result | User asked for simulation/description, and a fake image would be misleading |
| Creative restyling presets | Initial scope is faithful upscale and preservation first |
| Backend migration for provider calls | Important architectural concern, but not part of this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UPS-01 | Phase 1 | Pending |
| UPS-02 | Phase 2 | Pending |
| UPS-03 | Phase 1 | Pending |
| UPS-04 | Phase 1 | Pending |
| UPS-05 | Phase 1 | Pending |
| UPS-06 | Phase 2 | Pending |
| UPS-07 | Phase 4 | Pending |
| ANL-01 | Phase 3 | Pending |
| ANL-02 | Phase 3 | Pending |
| PRM-01 | Phase 3 | Pending |
| PRM-02 | Phase 3 | Pending |
| PRM-03 | Phase 3 | Pending |
| PRV-01 | Phase 4 | Pending |
| PRV-02 | Phase 4 | Pending |
| GDE-01 | Phase 4 | Pending |
| GDE-02 | Phase 4 | Pending |
| REL-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*  
*Last updated: 2026-03-16 after research synthesis*
