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
