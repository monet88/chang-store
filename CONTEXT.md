# Chang Store Domain Context

The core domain model and ubiquitous language for the AI fashion studio application.

## Language

**Studio Mode**:
The top-level operational persona of the workspace, selecting which AI engine powers image creation.
- `gemini`: Google Gemini SDK (`@google/genai`) via CPA gateway route (`gemini-native`).
- `gptImage`: OpenAI-compatible images route via Image gateway profile (`openai-images`).
- `localQwen`: Local Qwen image generation through the workstation's ComfyUI runtime.
_Avoid_: Engine mode, Provider tab, AI flavor.

**Gemini Studio**:
The dedicated studio interface for Google Gemini, hosting 10 fashion creation/editing features with aspect-ratio and resolution controls.
_Avoid_: Default studio, Google tab.

**GPT Studio**:
The dedicated studio interface tailored for OpenAI GPT Image models. It hosts five features today - Virtual Try-On, Lookbook, Clothing Transfer, AI Editor and Identity Transfer - mirroring their Gemini twins while adapting the controls to pixel dimensions and generation qualities. The remaining five features follow in phase 2.
_Avoid_: Provider studio, OpenAI wizard.

**Local Qwen Studio**:
The studio interface powered by Qwen image generation on the user's workstation, owned by the local ComfyUI process. Its initial product scope is Virtual Try-On, Clothing Transfer, Identity Transfer, and AI Editor. Local generation produces a reviewable result first; upscale remains an explicit user action after the user decides the result is worth keeping. The packaged desktop app owns that process in Electron main; the browser build reaches the same manager only through the `vite dev` bridge, so the studio is available on the web while the dev server is running and absent from a static deployment.
_Avoid_: NSFW mode, fallback mode, offline Gemini.

**Uncensored (UC) Model**:
The Local Qwen diffusion model `qwen-image-2.1-UC-Q4_K_M.gguf`, the default unet resolved at runtime by `resolveActiveUnet()` with automatic fallback to the standard `qwen-image-2.1-Q4_K_M.gguf` when the UC file is absent from the configured ComfyUI folder. The studio reports the resolved unet — and only then the `Uncensored (UC)` badge — after detection has actually found a file on disk; an install where neither unet resolves reports no model and no badge instead of claiming UC.
_Avoid_: NSFW model, unfiltered mode, UC mode.

**FaceSwap LoRA**:
The Local Qwen identity adapter `bfs_head_v1.1_qwen_2.1.safetensors`, injected between `UnetLoaderGGUF` and `KSampler` for jobs that transplant a face onto a destination photo. A workflow that does so declares it (`workflow: 'identity-transfer'`); a prompt that explicitly refuses swapping never gets the LoRA, whatever the caller declared. Detection runs against the same ComfyUI root generation loads models from, and the badge reports nothing until the file is actually found.
_Avoid_: identity LoRA, face preset, BFS preset.

**Outfit Drape Invariant**:
The cross-family studio rule that a top stays untucked outside the waistband, with no exception for a pre-tucked subject or a high-waisted bottom. Unlike role framing or prompt structure, this wording is owned once and imported verbatim by all three prompt families, because breaking it is a domain failure rather than a styling choice.
_Avoid_: tuck rule, untuck setting, hemline preference.

**Image Driver**:
The transport layer abstraction responsible for executing image generation or edit requests against a specific image-engine contract (`gemini-native`, `openai-images`, or local ComfyUI). Defined via the canonical `ImageDriver` polymorphic seam (`generate`, `generateOne`, `upscale`) consuming typed semantic roles (`ReferenceRoleImage`: `subject`, `garment`, `style`, `mask`). Transport calls are decoupled from UI controls through a Dual-Plane Facade (`ImageEngineContext`), while hardware safety on workstation GPUs is guarded by a module-level single-flight mutex (`localQwenLock`, `maxConcurrency: 1`).
_Avoid_: Provider client, API connector, transport engine.

**Gateway Profile**:
A persisted configuration binding a driver, base URL, and credentials to a specific gateway destination.
- `gemini`: Single CPA gateway route for multimodal text and image generation.
- `image`: OpenAI-compatible gateways specialized in `/v1/images/*`.
_Avoid_: API setting, Proxy config.

**Feature**:
One of the 10 distinct fashion generation workflows:
1. `TryOn` (`try-on`): Virtual Try-On dressing models in selected clothing items.
2. `Lookbook` (`lookbook`): Fashion lookbook catalog creation.
3. `Background` (`background`): Background scene replacement.
4. `Pose` (`pose`): Subject pose modification with framing presets.
5. `PhotoAlbum` (`photo-album`): Thematic photo album generator.
6. `AIEditor` (`ai-editor`): Natural language image retouching and editing.
7. `WatermarkRemover` (`watermark-remover`): Batch watermark removal and restoration.
8. `ClothingTransfer` (`clothing-transfer`): Garment transfer between photos.
9. `IdentityTransfer` (`identity-transfer`): Preserving subject facial/body identity into target scenes.
10. `PatternGenerator` (`pattern-generator`): Seamless fabric and textile pattern generator.

**E-Com Pack**:
A batch generation workflow within `ClothingTransfer` producing a complete e-commerce asset bundle from a single source model photo: product display assets (Flat Lay, Hanger), brand model shots, and diverse model variations.
_Avoid_: All-in-one generator, batch wizard, auto lookbook.

**Garment Scope**:
The explicit classification of clothing items extracted from the source image (`top`, `bottom`, `outerwear`, `dress`, `full-set`). Drives targeted transfer and isolated or coordinated staging. For `bottom`, the garment architecture must be deterministically classified as either bifurcated (trousers/pants/shorts with two separate leg openings) or continuous (skirt with a single hem circumference), rejecting ambiguous hybrid designations.
_Avoid_: Item tag, clothing label, cut mode.

**Display Template**:
A target staging specification for non-model product shots, implemented either as an Image Template (visual reference defining surface, lighting, and composition) or a Text Template (prompt-driven staging recipe). Covers Flat Lay, Hanger, and Ghost Mannequin presentations.
_Avoid_: Mockup, backdrop preset, canvas scene.

**Model Roster**:
A collection of target model destinations consisting of a persistent Brand Model profile and selectable preset or custom model profiles with varied demographics, body types, and shooting environments.
_Avoid_: Target gallery, avatar list, mannequin selector.

**AI Scan**:
The optional analytical pre-pass of the studio that deconstructs source garments
into a model-agnostic technical blueprint: weave and material, optical finish,
weight and drape physics, and micro-edge details. The blueprint records observed
garment facts under strict invariants: bottom garments enforce deterministic bifurcation
analysis (distinguishing pants from skirts by ankle cuffs, hem separation, and inseam/crotch
construction, strictly banning hedging like "A (or B)"), and explicit user guidance notes
take absolute priority over ambiguous visual cues. Gemini, GPT Image, and Local Qwen prompt
policies decide independently how to use those facts during synthesis. Each generation job
owns the blueprint for its own source set, so one job never inherits another job's garment
analysis. AI Scan is a single ON/OFF layer persisted per install, covering Virtual Try-On
(both modes), Lookbook, Identity Transfer, Pose Changer and Background Replacer; the
E-Com Pack uses the same analysis semantics. A disabled, failed or cancelled scan
falls back silently to the base prompt.
_Avoid_: Outfit analysis, garment inspector, deep scan, fabric detection.

**Semantic Judgment**:
The fast, structured decision layer of the studio powered by System One models (TypeSafe Jev). It evaluates application state, source item text, and AI Scan blueprints to return typed determinations: discrete category selection (`Choice`), condition verification (`Noul`), and graded rubric scoring (`Score`), without generating free-form text or unparsed prose. Semantic Judgment operates on text representations and acts as a common-sense classifier and validator before image synthesis pipelines run.
_Avoid_: Text AI, AI Assistant, Chatbot, Smart Filter.
