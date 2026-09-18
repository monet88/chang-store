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
src/App.tsx. Gemini is the default full-featured studio. Grok and GPT Image
are isolated provider studios using src/services/providers/ and the shared
provider-studio hooks. Provider results remain local-only and do not write to
the Gemini gallery pipeline.

#### Provider Studio Parity Matrix

| Workflow | Gemini | Grok | GPT Image | Current notes |
| --- | --- | --- | --- | --- |
| Virtual Try-On | Yes | Yes | Yes | Provider studios support source-item types/notes and multi-person targeting. |
| Lookbook | Yes | Yes | Yes | Provider studios support core controls; variations and close-ups remain deferred. |
| Clothing Transfer | Yes | Yes | Yes | Uses the provider prompt adapter and provider REST service. |
| Identity Transfer | Yes | No | No | Gemini-only batch edit using shared identity references and per-destination jobs. |
| Pattern Generator | Yes | Yes | Yes | Provider studios support prompt-driven generation. |
| AI Editor | Yes | Yes | Yes | Requires a source image in provider studios. |
| Background Replacer | Yes | No | No | Gemini-only workflow. |
| Pose Changer | Yes | No | No | Gemini-only workflow. |
| Photo Album | Yes | No | No | Gemini-only workflow. |
| Watermark Remover | Yes | No | No | Gemini-only workflow. |

Provider studios defer Lookbook variations, Lookbook close-ups, and automatic
clothing description because no provider text endpoint is wired for those paths.

The current source tree has no server-side request, session, or audit-log
layer. The generic server layering and observability sections above are
planning constraints for future backend work, not claims about the current SPA.
