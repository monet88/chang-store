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
      -> ImageGalleryProvider
        -> ImageViewerProvider
          -> AppContent
~~~

### Studio Modes

AppContent owns the Feature routing and StudioMode switch. Feature values and
provider support are defined in src/types.ts; route/component wiring is in
src/App.tsx. Two engines ship: the Gemini studio (default, ten workflows) and
the GPT Image studio.

Both studios run the same workflow hooks and the same prompt builders; the
engine underneath is what changes. `src/contexts/ImageEngineContext.tsx` is that
seam — it exposes `{ id, model, editImage, upscaleImage,
createImageChatSession, options }` for the active mode, the Gemini lane backed
by `src/services/imageEditingService.ts` and the GPT lane by
`src/services/providers/gpt-image/gptImageEngine.ts`. The GPT adapter maps the
requested ratio to the pixel size the active (gateway, model) pair actually
honors, turns a refine into one stateless preservation-wrapped edit (because
OpenAI-style edit endpoints keep no conversation), and flattens Gemini-style
interleaved parts into one prompt and ordered reference images.

Generation controls follow the engine: the Gemini views render aspect ratio and
resolution (`ImageOptionsPanel`), the GPT views render ratio, the resolved pixel
size, and quality (`src/components/studios/GptImageOptionsPanel.tsx`) — both
derived from the capability catalog, never from a hardcoded table. Every result
is persisted to the shared IndexedDB gallery tagged with its feature and the
engine that produced it.

#### Workflow Matrix

| Workflow | Gemini | GPT Image |
| --- | --- | --- |
| Virtual Try-On | Yes | Yes |
| Lookbook | Yes | Yes |
| Clothing Transfer | Yes | Yes |
| AI Editor | Yes | Yes |
| Identity Transfer | Yes | Yes |
| Background Replacer | Yes | No |
| Pose Changer | Yes | No |
| Photo Album | Yes | No |
| Watermark Remover | Yes | No |
| Pattern Generator | Yes | No |

The five Gemini-only workflows are phase 2 of the studio consolidation: they
already take their driver from the same context, they simply have no GPT view
yet. GPT caps stay deliberate — one output per request, lookbook variations
capped at one, wardrobe sets bounded to two, serial batches, and no native
upscale (upscale is a preservation-prompted edit at the largest quality).

The current source tree has no server-side request, session, or audit-log
layer. The generic server layering and observability sections above are
planning constraints for future backend work, not claims about the current SPA.
