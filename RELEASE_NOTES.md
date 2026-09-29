Thank you so much for using Chang Store and for your continued support! ❤️

v1.4.0 brings offline generation powered by Local Qwen Studio and ComfyUI, smart AI Scan with textile blueprint heuristics, high-concurrency cloud batch processing, and a production-grade Electron desktop shell with Windows packaging.

## The short version

- **Local Qwen Studio:** Offline local generation backed by ComfyUI, featuring Uncensored DiT (`qwen-image-2.1-UC`) as default, BFS FaceSwap LoRA v1.1 integration, and 6-step Turbo LoRA speedups.
- **AI Scan & Textile Blueprint:** Smart garment bifurcation heuristics (pants vs. skirts), anti-tuck draping overrides, and operator outfit guidance notes.
- **High Concurrency & Batch Uploads:** Parallel cloud generation scaled up to 10 concurrent requests with dynamic 1/2/3/4-column responsive layout for multi-garment try-on.
- **Production Desktop Shell & CI:** Secure Electron desktop architecture, OS-encrypted credential storage via safeStorage, and automated Windows packaging for Portable and NSIS Setup executables.

---

### Local Qwen Studio & ComfyUI Pipeline

*Offline generation directly on your Windows PC with uncensored model defaults, LoRA face swapping, and real-time progress tracking.*

* feat(182): desktop-only Local Qwen Studio backed by ComfyUI by @monet88 in https://github.com/monet88/chang-store/pull/190
* feat: integrate Uncensored DiT model (`qwen-image-2.1-UC-Q4_K_M.gguf`) as default with fallback detection by @monet88 in https://github.com/monet88/chang-store/pull/193
* feat: BFS FaceSwap LoRA v1.1 auto-routing for Identity Transfer and Brand Models with refusal guard by @monet88 in https://github.com/monet88/chang-store/pull/193
* feat: support 6-step Turbo LoRA (`Qwen-Image-2.1-viggle-turbo`) for high-speed local inference by @monet88 in https://github.com/monet88/chang-store/pull/193
* feat: surface real-time generation progress, cancellation, and recoverable error reporting by @monet88 in https://github.com/monet88/chang-store/pull/190
* feat: explicit Local Qwen image upscale without cloud fallback by @monet88 in https://github.com/monet88/chang-store/pull/190

### Studio AI Scan, E-Com Pack & Fashion Prompts

*Textile blueprint recognition gains lower-body bifurcation rules, manual scan triggers, and anti-tuck draping policies.*

* feat(clothing-transfer): complete E-Com Pack studio workflow by @monet88 in https://github.com/monet88/chang-store/pull/180
* feat(studio): AI Scan textile-blueprint layer across studio workflows by @monet88 in https://github.com/monet88/chang-store/pull/163
* feat(vto): lower-body bifurcation rule (2 leg cuffs vs continuous hem) and anti-hedging directives by @monet88 in https://github.com/monet88/chang-store/pull/193
* feat(vto): anti-tuck policy to keep shirts untucked outside waistbands across all prompt builders by @monet88 in https://github.com/monet88/chang-store/pull/193
* feat: user outfit guidance notes merged into AI Scan & generation prompts by @monet88 in https://github.com/monet88/chang-store/pull/193
* feat(identity-transfer): Gemini Identity Transfer batch workflow by @monet88 in https://github.com/monet88/chang-store/pull/151
* feat(prompts): dual-engine prompt policies with structured AI Scan by @monet88 in https://github.com/monet88/chang-store/pull/175

### Performance, Batch Concurrency & UX

*Higher cloud concurrency, responsive batch grids, and UI accessibility improvements.*

* perf: scale batch concurrency up to 10 for cloud engines (`gemini`, `gptImage`) by @monet88 in https://github.com/monet88/chang-store/pull/193
* feat(vto): multi-garment upload with responsive 1/2/3/4 column dynamic layout by @monet88 in https://github.com/monet88/chang-store/pull/193
* perf: Watermark Remover slider and parallel worker ceiling raised to 10 by @monet88 in https://github.com/monet88/chang-store/pull/193
* a11y: focus-visible states and ARIA label enhancements across modal and selector components by @monet88 in https://github.com/monet88/chang-store/pull/113 and https://github.com/monet88/chang-store/pull/117
* perf: memoize context providers and expensive render components by @monet88 in https://github.com/monet88/chang-store/pull/60 and https://github.com/monet88/chang-store/pull/105

### Desktop Shell, Security & Windows Packaging

*Modernized Electron runtime with secure gateway boundaries and automated Windows executable releases.*

* feat(desktop): modernize Electron desktop shell and secure gateway boundary by @monet88 in https://github.com/monet88/chang-store/pull/181
* security: prevent unwanted API key autofill in browser and desktop fields by @monet88 in https://github.com/monet88/chang-store/pull/179
* ci: automated Windows release workflow building Portable and NSIS Setup executables by @monet88 in https://github.com/monet88/chang-store/pull/194
* feat: custom indigo-to-fuchsia camera-lens logomark embedded in Windows executables by @monet88 in https://github.com/monet88/chang-store/pull/193

---

**Full Changelog**: https://github.com/monet88/chang-store/compare/v1.3...v1.4.0
