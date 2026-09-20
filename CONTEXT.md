# Chang Store Domain Context

The core domain model and ubiquitous language for the AI fashion studio application.

## Language

**Studio Mode**:
The top-level operational persona of the workspace, selecting which AI engine powers image creation.
- `gemini`: Google Gemini SDK (`@google/genai`) via CPA gateway route (`gemini-native`).
- `gptImage`: OpenAI-compatible images route via Image gateway profile (`openai-images`).
_Avoid_: Engine mode, Provider tab, AI flavor.

**Gemini Studio**:
The dedicated studio interface for Google Gemini, hosting 10 fashion creation/editing features with aspect-ratio and resolution controls.
_Avoid_: Default studio, Google tab.

**GPT Studio**:
The dedicated studio interface tailored for OpenAI GPT Image models. It hosts five features today - Virtual Try-On, Lookbook, Clothing Transfer, AI Editor and Identity Transfer - mirroring their Gemini twins while adapting the controls to pixel dimensions and generation qualities. The remaining five features follow in phase 2.
_Avoid_: Provider studio, OpenAI wizard.

**Image Driver**:
The transport layer abstraction responsible for executing image generation or edit requests against a specific API contract (`gemini-native` or `openai-images`).
_Avoid_: Provider client, API connector.

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
The explicit classification of clothing items extracted from the source image (`top`, `bottom`, `outerwear`, `dress`, `full-set`). Drives targeted transfer and isolated or coordinated staging.
_Avoid_: Item tag, clothing label, cut mode.

**Display Template**:
A target staging specification for non-model product shots, implemented either as an Image Template (visual reference defining surface, lighting, and composition) or a Text Template (prompt-driven staging recipe). Covers Flat Lay, Hanger, and Ghost Mannequin presentations.
_Avoid_: Mockup, backdrop preset, canvas scene.

**Model Roster**:
A collection of target model destinations consisting of a persistent Brand Model profile and selectable preset or custom model profiles with varied demographics, body types, and shooting environments.
_Avoid_: Target gallery, avatar list, mannequin selector.

**AI Scan**:
The optional analytical pre-pass of the studio: a Gemini vision pass
(`gemini-3.8-flash`) that deconstructs the source garments of a feature —
weave and material, optical finish, weight and drape physics, micro-edge details
— into a technical blueprint before synthesis, spliced into the image prompt as
a subordinate specification. It is a single ON/OFF layer, persisted per install,
covering Virtual Try-On (both modes), Lookbook, Identity Transfer, Pose Changer
and Background Replacer; the E-Com Pack runs the same analysis through its own
lane. A disabled, failed or cancelled scan falls back silently to the base
prompt.
_Avoid_: Outfit analysis, garment inspector, deep scan, fabric detection.
