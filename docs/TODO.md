# TODO

> Danh sách công việc cần làm cho Chang-Store.  
> Cập nhật: 28/04/2026 · Ưu tiên: 🔴 Critical · 🟡 Important · 🟢 Nice-to-have

---

## 🔴 Critical — Làm Ngay

### Persistence & Data Safety
- [ ] **IndexedDB cho gallery images** — base64 in memory sẽ OOM trên thiết bị yếu, close tab mất hết kết quả
  - Files: `src/contexts/ImageGalleryContext.tsx`, `src/utils/storage.ts`
  - Approach: `idb-keyval` hoặc raw IndexedDB wrapper
- [ ] **Auto-save session state** — form inputs, current feature, generation results
  - Scope: `src/App.tsx` (feature state), mỗi hook (form state)

### Component Size
- [x] ~~**Split `ImageEditor.tsx`**~~ — Feature removed entirely (v1.0.4). ImageEditor, ImageEditorCanvas, ImageEditorToolbar deleted along with retired features (OutfitAnalysis, Relight, Upscale, ImageEditor).

### Data Architecture
- [ ] **Extract pose data từ locale files** — `poseChanger.poseCollections` trong `en.ts` chứa hàng trăm dòng pose data + GitHub URLs
  - Move to: `src/data/poseLibrary.ts`
  - Chỉ giữ translatable labels trong locales

---

## 🟡 Important — Sprint Tiếp Theo

### Navigation
- [ ] **Hash routing** — `#/try-on`, `#/lookbook`, etc.
  - Cần: browser back/forward, deep linking, bookmark
  - Approach: lightweight custom hash router (không cần react-router)
  - Files: `src/App.tsx`
- [ ] **"Recently used" feature list** — hiển thị 3 features gần nhất ở top sidebar

### Developer Experience
- [ ] **`CONVENTIONS.md`** — document:
  - Tailwind class pattern variables (`panelClass`, `labelClass`, `primaryButtonClass`, etc.)
  - Component structure conventions
  - Hook naming & export patterns
  - Error handling pattern: `try/catch/finally` template
- [ ] **Feature Registry** — thay thế switch-case trong `App.tsx`
  ```typescript
  // src/config/featureRegistry.ts
  export const FEATURE_REGISTRY: Record<Feature, FeatureConfig> = {
    [Feature.TryOn]: { component: lazy(() => import(...)), group: 'create', ... },
  };
  ```
- [ ] **`npm run scaffold:feature <name>`** — script tạo 5 files:
  1. `src/components/<Name>.tsx` (component boilerplate)
  2. `src/hooks/use<Name>.ts` (hook boilerplate)
  3. `src/locales/en.ts` (thêm keys)
  4. `src/locales/vi.ts` (thêm keys)
  5. `__tests__/hooks/use<Name>.test.ts` (test boilerplate)
- [ ] **Mock API mode** (`VITE_USE_MOCKS=true`)
  - Files: `src/services/gemini/*.ts` — wrap mỗi function với mock fallback
  - Mock data: `__tests__/__mocks__/geminiResponses.ts`

### UX
- [ ] **Multi-step progress UI** — thay `<Spinner />` bằng contextual messages
  - "Analyzing image..." → "Isolating subject..." → "Applying background..."
  - Files: mỗi hook's `loadingMessage` state (pattern đã có trong `useVirtualTryOn`)
- [ ] **Swipe-to-compare** slider cho before/after
  - Candidate component: `src/components/ImageComparator.tsx` (đã có, 2KB — extend)

### Quality
- [ ] **Zod validation cho Gemini outputs** — generative APIs hallucinate JSON
  - Files: `src/services/gemini/text.ts`
  - Add: `zod` dependency, schema definitions cho mỗi structured response
- [ ] **ADRs** — Architecture Decision Records
  - Tạo `docs/decisions/` directory
  - ADR-001: Why Gemini-only?
  - ADR-002: Why no React Router?
  - ADR-003: Provider nesting order rationale
  - ADR-004: Component/Hook separation philosophy

---

## 🟢 Nice-to-have — Backlog

### UX Enhancements
- [ ] **Guided onboarding** — first-time user flow highlighting 3 core features
- [ ] **Global drag-and-drop** — kéo ảnh vào bất kỳ đâu → route tới tool phù hợp
- [ ] **Pipeline concept** — chain features: shoot → relight → upscale → export
- [ ] **Token/cost estimator** — "Estimated cost: ~X API credits" trước generation
- [ ] **Keyboard shortcuts** — Ctrl+G (gallery), Ctrl+P (prompt library), Ctrl+S (save)

### Feature Tiering
- [ ] Phân loại sidebar: Core / Supporting / Labs sections
- [x] ~~Merge AI Editor + Image Editor → single unified editor~~ — ImageEditor removed (v1.0.4), AI Editor is the unified editor
- [ ] Evaluate Virtual Try-On vs. Clothing Transfer overlap

### Testing
- [ ] **Integration tests** — E2E feature flow tests (upload → generate → save → gallery)
- [ ] **Visual regression** — Playwright screenshot snapshots
- [ ] **Accessibility audit** — WCAG 2.1 AA compliance
- [ ] **Performance benchmarks** — measure memory usage với batch operations

### Architecture
- [ ] **Provider abstraction** — interface cho image providers, Gemini implements it
- [ ] **Thin backend exploration** — auth, metering, result persistence
- [ ] **PWA support** — service worker, installable, offline gallery viewing
- [ ] **Streaming results** — progressive image rendering thay vì blank→done

### Documentation
- [ ] **Index prompt builders** — catalog `src/utils/*-prompt-builder.ts` trong docs
- [ ] **Component gallery** — visual catalog của shared UI components
- [ ] **Contributing guide** — cho external contributors

---

## Ghi Chú

### Không Làm (Anti-patterns)
- ❌ Không thêm feature mới cho tới khi v2.0 foundation xong
- ❌ Không import services trực tiếp từ components (dùng hooks)
- ❌ Không dùng `@ts-ignore` hoặc `any` trừ khi tuyệt đối cần thiết
- ❌ Không tạo file V2/new — edit in place
- ❌ Không xóa file hoặc chạy destructive git commands mà không hỏi

### Definition of Done
Mỗi task cần:
1. Code implementation
2. `npx tsc --noEmit` pass
3. `npm run lint` pass
4. Tests (nếu logic change)
5. i18n keys (nếu UI change)
6. GitNexus impact analysis (nếu modify existing symbols)
