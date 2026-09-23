# Desktop-only Local Qwen studio

Chang Store will add Local Qwen as a third, **desktop-only** Studio Mode rather than a hidden cloud fallback or a browser feature. The Electron main process owns the lifecycle of any ComfyUI process it starts, while externally started ComfyUI instances remain externally owned; app quit cancels an active app-owned job and stops only the app-owned process. This keeps local/private generation explicit and prevents renderer-side process control or silent cloud disclosure.

Local Qwen initially supports Virtual Try-On, Clothing Transfer, Identity Transfer, and AI Editor through its own Qwen-specific prompt family at the existing Image Driver seam. Jobs are serialized for the target 8 GB GPU, generation defaults to 512 px, and upscale is always an explicit post-generation user action. Failures stay local and never automatically fall back to Gemini or GPT Image.
