# Requirements: Chang-Store

**Defined:** 2026-03-16  
**Core Value:** Users can turn fashion reference images into production-ready visual assets quickly, with predictable quality and minimal manual tool-hopping.

## v1 Requirements

### Workflow

- [ ] **UPS-01**: User can upload multiple fashion lookbook images and keep them available inside the Upscale feature during one session
- [ ] **UPS-02**: User can keep using a direct in-app `Quick Upscale` flow with before/after comparison
- [ ] **UPS-03**: User can move through the `AI Studio` steps inside the Upscale feature without leaving the screen or switching to another feature
- [ ] **UPS-04**: User can run `AI Studio` without losing access to the `Quick Upscale` lane in the same feature screen
- [ ] **UPS-05**: User can select any uploaded image in the current Upscale session as the active image for `Quick Upscale` or `AI Studio`
- [ ] **UPS-06**: User can run `Quick Upscale` with the fixed preservation-first prompt defined for this milestone

### Analysis

- [ ] **ANL-01**: User can generate a structured analysis of the uploaded image covering model presentation, garments, materials, background, lighting, framing, and pose
- [ ] **ANL-02**: User can see preservation-risk notes for detail-sensitive areas such as text, logos, jewelry, embroidery, skin, and fabric texture

### Prompt Package

- [ ] **PRM-01**: User can receive one copy-ready English master prompt generated from the uploaded image and analysis for the Gemini workflow available in the app
- [ ] **PRM-02**: User can receive Gemini-oriented prompt guidance that prioritizes faithful upscale and detail preservation rather than creative restyling
- [ ] **PRM-03**: The `Quick Upscale` lane uses a fixed prompt that targets 4K output, sharper fabric texture, color accuracy, unchanged face, and unchanged composition

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
| UPS-01 | TBD | Pending |
| UPS-02 | TBD | Pending |
| UPS-03 | TBD | Pending |
| UPS-04 | TBD | Pending |
| UPS-05 | TBD | Pending |
| UPS-06 | TBD | Pending |
| ANL-01 | TBD | Pending |
| ANL-02 | TBD | Pending |
| PRM-01 | TBD | Pending |
| PRM-02 | TBD | Pending |
| PRM-03 | TBD | Pending |
| PRV-01 | TBD | Pending |
| PRV-02 | TBD | Pending |
| GDE-01 | TBD | Pending |
| GDE-02 | TBD | Pending |
| REL-01 | TBD | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16 ⚠️

---
*Requirements defined: 2026-03-16*  
*Last updated: 2026-03-16 after research synthesis*
