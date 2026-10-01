# Architecture

This repository is the Chang Store React/Vite application. The application source
is under `src/`. Product behavior is always derived from the current source tree.

The generic discovery and layering guidance below is planning guidance for
future application boundaries; it is not a claim that this SPA already has
server-side domain/application/infrastructure/interface layers.

## Discovery Before Shape

Before proposing implementation shape, identify:

- Product surfaces: browser, mobile, desktop, CLI, API, worker, or service.
- Runtime stack: language, framework, database, queues, providers, and hosting.
- Core domains: the product concepts that deserve stable names and contracts.
- Boundary inputs: user input, API requests, webhooks, jobs, files, credentials,
  provider payloads, and environment configuration.
- Validation ladder: the smallest checks that can prove the selected stack.

## Default Layering

```text
domain
  <- application
      <- infrastructure
          <- interface
              <- app surfaces
```

## Consumer Candidate Structure

```text
app/
  domain/
    entities/
    value-objects/
    repositories/
    services/

  application/
    commands/
    queries/
    handlers/

  infrastructure/
    database/
    logging/
    notifications/

  interface/
    controllers/
    dto/
    presenters/
    routes/
    middlewares/

surfaces/
  browser/
  mobile/
  desktop/
  cli/
```

This is a thinking template, not a scaffold. Create real folders only when a
story enters implementation and the selected stack needs them.

## Dependency Rule

Inner layers must not depend on outer layers.

| Layer | May depend on | Must not depend on |
| --- | --- | --- |
| domain | nothing project-external except tiny pure utilities | framework, database, UI, provider, process/env |
| application | domain | framework, UI, provider, database concrete clients |
| infrastructure | domain, application | interface controllers or UI |
| interface | all backend layers | UI state or platform shell assumptions |
| app surfaces | API contracts and app-facing clients | domain internals directly |

## Parse-First Boundary Rule

Unknown data must be parsed at boundaries before it enters inner code.

Boundaries include:

- HTTP request bodies, params, and query strings.
- Session payloads and identity claims.
- Environment variables.
- Database rows returned from external clients.
- Platform shell payloads.
- Deep links, tokens, and signed URLs.
- Provider webhooks, events, and async payloads.

Target flow:

```text
unknown input
  -> parser
  -> typed DTO or command
  -> application use case
  -> domain object/value object
```

Inner layers should work with meaningful product types such as `UserId`,
`AccountId`, `WorkspaceId`, `Role`, `DateRange`, or domain-specific IDs,
rather than repeatedly validating raw strings.

## Command/Query Boundary

If the product has both reads and writes, keep command/query separation clear at
the code level even when the storage layer is simple:

- Commands mutate state and own audit side effects.
- Queries read state and format for consumers.
- Shared domain rules live in domain/application, not controllers.

## Observability Contract

The future server should emit one canonical JSON log line per request with:

- timestamp
- level
- request_id
- user_id when known
- action
- duration_ms
- status_code
- message

Audit logs are product records. Application logs are operational records. Do not
use one as a substitute for the other.

## Chang Store application architecture

Chang Store is a client-only React/Vite SPA. The application source, not the
generic Harness candidate structure above, is authoritative for product
behavior:

~~~text
React component
  -> feature hook
    -> service facade
      -> provider SDK or REST endpoint
~~~

The app has no custom backend server. Browser-local persistence uses IndexedDB
for gallery/cache data and localStorage for session and preferences.
App-wide providers are ordered as:

~~~text
LanguageProvider
  -> ToastProvider
    -> ApiProvider
      -> AiScanProvider
        -> ImageGalleryProvider
          -> ImageViewerProvider
            -> AppContent
~~~

### Desktop surface

The Electron desktop app wraps the same React renderer without introducing a
second application architecture. `electron-vite` owns three desktop build
targets:

~~~text
electron/main.ts
  -> electron/preload.ts
    -> existing React renderer in src/
~~~

`vite.config.ts` remains the browser build source and exports the renderer
configuration reused by `electron.vite.config.ts`. Development loads the
renderer URL supplied by `electron-vite`; packaged/preview builds load
`out/renderer/index.html` directly. The desktop package therefore has no
runtime static HTTP server.

The preload boundary is intentionally narrow. Besides desktop environment
metadata, it exposes named gateway capabilities for model discovery, Gemini
`generateContent`, and OpenAI-compatible image generate/edit requests. The
renderer never receives a generic IPC escape hatch.

On desktop, persisted gateway credentials are moved from renderer localStorage
into an Electron-main vault encrypted with `safeStorage`; localStorage keeps only
a sentinel reference. Each stored credential is bound to its provider base URL,
IPC payloads are parsed in main before use, and provider network traffic runs in
main with renderer `webSecurity` enabled. Provider-returned image URLs are fetched
only after DNS resolution and public-address checks; redirects are revalidated and
the connection is pinned to the checked address to avoid DNS rebinding into local
or private networks. The browser build keeps the existing direct-provider/
localStorage contract. See `docs/architecture/chatbox-desktop-audit.md`.

Desktop packaging produces two Windows distribution formats through
`electron-builder`:

| Script | Target | Output | Startup |
| --- | --- | --- | --- |
| `npm run dist:win` | portable | `Chang Store-<ver>-portable.exe` | Self-extracts to `%TEMP%` each launch |
| `npm run dist:win:installer` | nsis | `Chang Store-<ver>-setup.exe` | Installs to Program Files, runs directly |

Both scripts live under `scripts/` and share the same `package.json` `build`
section. The app icon (`build/icon.ico`) is embedded into each executable.

### Studio Modes

AppContent owns the Feature routing and StudioMode switch. Feature values and
provider support are defined in src/types.ts; route/component wiring is in
src/App.tsx. The browser product ships Gemini and GPT Image studios. A third,
Local Qwen studio is backed by a local ComfyUI runtime (ADR-0004) and is
reachable whenever a process owns that runtime: the packaged desktop app
(Electron main) always, and the browser build only while `vite dev` hosts the
manager through its Local Qwen dev bridge.

The studios may share workflow hooks, UI state and model-agnostic domain data,
but prompt policy is model-family-specific. Gemini, GPT Image, and Local Qwen
must be free to use different instructions, role framing, preservation rules,
negative guidance and prompt structure because the models respond differently.
`src/contexts/ImageEngineContext.tsx` is the execution seam — it exposes
`{ id, model, editImage, upscaleImage, createImageChatSession, options }` for
the active mode. The current cloud lanes are backed by
`src/services/imageEditingService.ts` (Gemini) and
`src/services/providers/gpt-image/gptImageEngine.ts` (GPT Image); Local Qwen
joins the same seam through the desktop ComfyUI bridge rather than
forking Feature workflows.

Gemini, GPT Image, and Local Qwen feature workflows assemble requests through
independent prompt policies at the engine seam rather than forcing shared
wording across model families. Gemini receives interleaved
`[label, image, …]` parts, GPT uses one role map plus ordered reference images,
and Local Qwen translates the same model-agnostic Feature inputs into the
deterministic reference ordering and text expected by `TextEncodeQwenImage21`.
Transport helpers (`imagePart` in `src/utils/imagePart.ts`) and truly
model-agnostic prompt fragments may still be shared when doing so does not
constrain a model family.

The GPT adapter also maps the requested ratio to the pixel size the active
`(gateway, model)` pair actually honors and turns a refine into one stateless
preservation-wrapped edit because OpenAI-style edit endpoints keep no
conversation. Neither endpoint has a negative field, so user negative guidance
is appended to the request prompt; the exact framing may differ by model family.

Generation controls follow the engine: the Gemini views render aspect ratio and
resolution (`ImageOptionsPanel`), the GPT views render ratio, the resolved pixel
size, and quality (`src/components/studios/GptImageOptionsPanel.tsx`) — both
derived from the capability catalog, never from a hardcoded table. Resolution is
a request parameter, not a prompt line: `editImage` maps it to
`imageConfig.imageSize` (`src/services/gemini/image.ts`), so no builder pins a
resolution in its text. Every result
is persisted to the shared IndexedDB gallery tagged with its feature and the
engine that produced it.

### Deepening decisions

The September 2026 architecture review settled four directions. These describe
where complexity should concentrate when the affected code is next changed; they
do not require speculative scaffolding ahead of that work.

1. **Shared Feature UI, separate prompt families.** Gemini and GPT variants may
   share model-agnostic UI, upload/reference state, batch/result state and Feature
   workflow. Engine-specific controls stay at the existing engine seam. Prompt
   policy does not cross that seam: Gemini and GPT Image keep separate deep prompt
   modules as recorded in ADR-0002.
2. **AI Scan belongs to the generation job.** Source selection, the analysis
   promise and the resulting technical blueprint belong to one generation job.
   The panel may observe that same analysis and the prompt module may consume its
   blueprint, but no provider-wide blueprint may represent multiple independent
   batch jobs. The blueprint itself remains model-agnostic; Gemini and GPT prompt
   modules decide independently how to express it.
3. **Deepen only the E-Com Pack run.** E-Com Pack stays inside
   `ClothingTransfer` per ADR-0001. Keep ordinary form and selection state simple;
   concentrate target planning, blueprint use, bounded batch execution and
   regenerate-one behavior behind the E-Com Pack run module. Do not introduce a
   workflow engine or new run persistence without a demonstrated resume need.
4. **Reuse generated-result mechanics only where the seam is proven.** Virtual
   Try-On and Clothing Transfer already expose the same upscale/refine/download
   mechanics with two concrete collection adapters, so that duplicated
   implementation may be deepened behind one interface. Do not generalize this
   across Lookbook, Pose, Background or other Features until another Feature
   proves the same seam rather than merely resembling it.

#### Workflow Matrix

| Workflow | Gemini | GPT Image | Local Qwen (desktop) |
| --- | --- | --- | --- |
| Virtual Try-On | Yes | Yes | Yes |
| Lookbook | Yes | Yes | No |
| Clothing Transfer | Yes | Yes | Yes |
| AI Editor | Yes | Yes | Yes |
| Identity Transfer | Yes | Yes | Yes |
| Background Replacer | Yes | No | No |
| Pose Changer | Yes | No | No |
| Photo Album | Yes | No | No |
| Watermark Remover | Yes | No | No |
| Pattern Generator | Yes | No | No |

The five Gemini-only workflows are phase 2 of the studio consolidation: they
already take their driver from the same context, they simply have no GPT view
yet. GPT caps stay deliberate — one output per request, lookbook variations
capped at one, wardrobe sets bounded to two, batch generation capped at 10
parallel requests (see `resolveEngineConcurrency` in
`src/utils/engineDispatch.ts`), and no native upscale (upscale is a
preservation-prompted edit at the largest quality).

Job concurrency is not the same thing as request concurrency: a job may fan out
one request per output image, so 10 jobs of 4 images would put 40 requests on
the wire. Every cloud request therefore goes through one shared gate of 10
in-flight requests (`withImageRequestSlot` in `src/utils/request-slots.ts`) —
the Gemini and GPT lanes share it, upscales included. The gate re-checks the
cap after waking a waiter, because a caller already queued in the microtask
queue can otherwise claim the freed slot first.

Local Qwen is narrower by design. It ships as a serial engine (one active job
at a time), defaults to 512 px on the target 8 GB GPU, keeps upscale as a
separate explicit user action, and never falls back to cloud automatically.

Local-process ownership sits in one place: Electron main in the packaged app,
the `vite dev` bridge while testing in a browser. The bridge is opt-in
(`LOCAL_QWEN_DEV_BRIDGE=true`) because it can start ComfyUI for anyone who
reaches the dev server, which listens on every interface by default. See
`docs/api/localQwen-api-guide.md` for the measured runtime contract.

The current source tree has no server-side request, session, or audit-log
layer. The generic server layering and observability sections above are
planning constraints for future backend work, not claims about the current SPA.

### ImageDriver Seam and Provider Adapters

The image generation and editing transport layer is unified behind a polymorphic seam
(`src/services/providers/ImageDriver.ts`). This decouples all 10 fashion studio features from
provider-specific wire formats, while `ImageEngineContext.tsx` acts as a backward-compatible
Dual-Plane Facade preserving UI controls (`options`, `modelOptions`, `setModel`):

```text
[UI Panels: GptStudio, GptImageOptionsPanel]
                 │ (UI options, model picker)
                 ▼
     [ImageEngineContext Facade]
                 │ (delegates transport)
                 ▼
[10 Fashion Feature Hooks] ──────► [useImageDriver()]
                                          │
                                          ▼
                                   [ImageDriver]
                                ┌─────────┴─────────┐
                                │                   │
             ┌──────────────────┼───────────────────┼──────────────────┐
             ▼                  ▼                   ▼                  ▼
     [GeminiAdapter]      [GptAdapter]      [LocalQwenAdapter]    [InMemoryFake]
     - interleavedParts   - ratio -> px     - localQwenLock       - job recording
     - 1K/2K/4K tiers     - request slot    - FaceSwap guard      - deferNext()
     - safety mapping     - neg prompt      - non-retriable OOM   - deterministic
```

- **Interface Contract**: Exposes `generate(job)`, `generateOne(job)`, and `upscale(job)` using typed semantic reference roles (`ReferenceRoleImage`: `subject`, `garment`, `style`, `mask`).
- **Hardware Mutex**: `LocalQwenImageDriverAdapter` serializes all execution through a module-level mutex (`localQwenLock`, `maxConcurrency: 1`) preventing GPU VRAM exhaustion (CUDA OOM) between generation and upscale.
- **Error Normalization**: All network, safety, quota, and hardware errors normalize to `StudioDriverError`. Hardware fatal errors (CUDA OOM, missing model weights) are marked non-retriable.
- **Test Doubles**: `InMemoryImageDriverFake` provides headless, deterministic testing supporting in-flight deferral (`deferNext()`), active `AbortSignal` cancellation, and progress event dispatching.

