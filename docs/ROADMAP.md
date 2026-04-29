# Roadmap

> Hướng đi chiến lược cho Chang-Store — AI-Powered Virtual Fashion Studio.  
> Cập nhật: 29/04/2026 · Phiên bản hiện tại: v1.0.4 (tag v1.5)

---

## Tổng Quan

```
v1.0 (MVP) ──→ v1.5 (Features) ──→ v2.0 (Foundation) ──→ v3.0 (Product) ──→ v4.0 (Scale)
  Done ✅          Done ✅           In Progress 🔨         Planned 📋          Future 🔮
```

---

## ✅ Đã Hoàn Thành

### v1.0 — MVP Foundation (2026-03-16)
- [x] 9 AI features: Try-On, Lookbook, Background, Pose, PhotoAlbum, AIEditor, WatermarkRemover, ClothingTransfer, PatternGenerator
- [x] Gemini-only architecture (remove multi-provider)
- [x] Google Drive sync integration
- [x] Full i18n (English + Vietnamese)
- [x] CI pipeline (GitHub Actions)

### v1.2 — Source Root Migration (2026-03-24)
- [x] Migrate toàn bộ source vào `src/`
- [x] Update alias, build config, test imports

### v1.3 — Virtual Try-On Optimization (2026-04-01)
- [x] Interleaved Part[] prompt builder
- [x] Flat 3-column batch result grid
- [x] Default 2K quality + 3:4 aspect ratio
- [x] AGENTS.md ở mọi directory level

### v1.4 — Prompt Library (2026-04-02)
- [x] Prompt Library modal (search, copy, curated prompts)
- [x] Batch download ZIP cho Try-On
- [x] Bounded concurrency workers

### v1.5 — Multi-Person & Polish (2026-04-02)
- [x] Multi-person targeting cho Virtual Try-On
- [x] Pattern Generator feature complete
- [x] React.memo performance pass

### Post-v1.5 — Architecture Hardening (2026-04-06 → 2026-04-28)
- [x] **Runway UI redesign** (#23)
- [x] Model registry & capability system
- [x] Service boundary refactor — hooks own all logic
- [x] UI import boundary enforcement tests
- [x] Settings modal hook + storage utilities

---

## 🔨 v2.0 — Foundation Strengthening (Tiếp Theo)

> **Mục tiêu:** Sửa các vấn đề nền tảng trước khi mở rộng thêm.

### Phase 1: Persistence Layer
- [ ] IndexedDB adapter cho gallery images (thay vì base64 in memory)
- [ ] Auto-save session state (feature position, form inputs, results)
- [ ] Export/import workspace data (JSON backup)

### Phase 2: Navigation & Routing
- [ ] Hash-based client-side routing (`#/try-on`, `#/lookbook`, etc.)
- [ ] Browser back/forward support
- [ ] Deep-linkable feature URLs
- [ ] "Recently used" feature section

### Phase 3: Developer Experience
- [ ] `CONVENTIONS.md` — document Tailwind class patterns, component conventions
- [ ] Feature Registry pattern — auto-register features, không sửa App.tsx
- [ ] `npm run scaffold:feature <name>` — codegen 5 files boilerplate
- [ ] Mock API mode (`VITE_USE_MOCKS=true`) cho testing không burn credits
- [ ] ADRs (Architecture Decision Records)

### Phase 4: Component Decomposition
- [x] ~~Split `ImageEditor.tsx`~~ — Feature removed entirely (v1.0.4)
- [ ] Split `LookbookForm.tsx`, `WatermarkRemover.tsx`, `ClothingTransfer.tsx`
- [ ] Extract pose data từ locale files vào data modules

---

## 📋 v3.0 — Product Polish

> **Mục tiêu:** Từ engineering artifact → sản phẩm thực sự.

### Phase 1: UX Improvements
- [ ] **Guided onboarding** — first-time user flow, highlight 3 core features
- [ ] **Multi-step progress UI** — thay spinner bằng contextual status messages
- [ ] **Swipe-to-compare** slider (original vs. generated)
- [ ] **Global drag-and-drop** — kéo ảnh vào app, tự route đến tool phù hợp
- [ ] **Pipeline/workflow concept** — chain features (shoot → relight → upscale → export)

### Phase 2: Feature Tiering
- [ ] Phân loại features: Core / Supporting / Labs
- [ ] Sidebar navigation theo tier — Core features nổi bật, Labs ẩn
- [x] ~~Merge overlapping: AI Editor + Image Editor → 1 tool~~ — ImageEditor removed (v1.0.4), AI Editor is the unified editor
- [ ] Evaluate: Try-On vs. Clothing Transfer overlap

### Phase 3: Quality & Trust
- [ ] Token/cost estimator — hiển thị estimated API credits trước generation
- [ ] Better error messages — diagnose tại sao generation thất bại
- [ ] Graceful degradation khi Gemini API có vấn đề
- [ ] Zod runtime validation cho Gemini JSON outputs

### Phase 4: Testing
- [ ] Integration test examples (E2E feature flows)
- [ ] Visual regression tests (Playwright snapshots)
- [ ] Accessibility audit (WCAG 2.1 AA)

---

## 🔮 v4.0 — Scale (Future)

> **Mục tiêu:** Mở rộng khả năng phục vụ và monetization potential.

### Exploration
- [ ] Thin backend layer (auth, usage metering, result persistence)
- [ ] Multi-provider support (provider abstraction layer, DALL-E/Flux fallback)
- [ ] Collaborative features (share lookbook, team workspaces)
- [ ] Analytics & telemetry (feature usage, drop-off tracking)
- [ ] PWA support (offline-capable, installable)
- [ ] Video generation integration (Veo, Kling)

---

## Metrics & Goals

| Metric | Current | v2.0 Target | v3.0 Target |
|--------|---------|-------------|-------------|
| Features | 9 | 9 (tiered) | ~8 (merged) |
| Prod dependencies | 4 | 5 (+idb) | 6 (+zod) |
| Test coverage | Moderate | High (boundaries + integration) | Comprehensive |
| Component max size | 58KB | <20KB | <15KB |
| Persistence | localStorage only | IndexedDB + Drive | IndexedDB + Drive + Backend |
| Routing | None | Hash routing | Hash routing |
| First-time UX | 13 features dumped on user | Recently used + tiered nav | Guided onboarding |
