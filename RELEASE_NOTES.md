Thank you so much for using Chang Store and for your continued support! ❤️

v1.5.0 unifies the image generation transport layer across all Studio modes (`gemini`, `gptImage`, `localQwen`) into a polymorphic `ImageDriver` seam, preserving domain invariants and hardware safety across all 10 fashion studio features.

## The short version

- **Unified Image Driver Seam:** Decoupled all 10 fashion studio features from provider-specific SDK formats behind polymorphic `ImageDriver` (`generate`, `generateOne`, `upscale`) and semantic reference roles (`ReferenceRoleImage`).
- **Hardware Mutex Protection:** Guarded Local Qwen ComfyUI generation and upscale through module-level mutex `localQwenLock` (`maxConcurrency: 1`), preventing fatal GPU VRAM exhaustion (CUDA OOM).
- **Dual-Plane Facade:** Retained `ImageEngineContext` as a backward-compatible UI controls facade (`options`, `modelOptions`, `setModel`) while delegating transport execution to `useImageDriver()`.
- **Normalized Driver Errors:** Normalized all transport failures into `StudioDriverError` categories, marking local ComfyUI errors non-retriable to prevent runaway loops.
- **Headless In-Memory Fake Double:** Hardened `InMemoryImageDriverFake` with job recording, in-flight deferral (`deferNext()`), and abort signal cancellation for fast, deterministic testing.

---

### Image Driver Architecture & Providers

*Polymorphic image transport seam across cloud and local engines.*

* refactor(providers): unify image driver seam and adapters across studio modes (#197) by @monet88 in https://github.com/monet88/chang-store/pull/204
* docs(architecture): document ImageDriver seam, provider adapters, and hardware mutex (#197) by @monet88 in https://github.com/monet88/chang-store/pull/204
* feat: add useLanguageOptional hook for stable translation access outside LanguageProvider
* fix: Vietnamese face-swap refusal false positives, Local Qwen interleavedParts, GPT retry

---

**Full Changelog**: https://github.com/monet88/chang-store/compare/v1.4.0...v1.5.0
