# Chatbox vs Chang Store desktop architecture audit

Audit date: 2026-09-21

Reference: `chatboxai/chatbox` at commit `0cf406cbd93197a89487c740cb101bef36641d35`

Relevant Chatbox source:

- `electron.vite.config.ts`
- `src/main/main.ts`
- `src/preload/index.ts`
- `electron-builder.yml`
- `release/app/package.json`

## Decision

Chang Store should copy Chatbox's **desktop process/build boundary**, not its whole desktop feature set.

The useful pattern is:

```text
Electron main
  -> sandboxed preload
    -> React renderer
```

with `electron-vite` building all three targets and the packaged app loading the generated renderer directly from disk.

Chang Store keeps the existing browser Vite build because it is still a supported development/deployment surface. The desktop build is additive and owns only the Electron shell.

## Port now

| Chatbox pattern | Chang Store action | Why now |
| --- | --- | --- |
| `electron-vite` owns main/preload/renderer builds | Add `electron.vite.config.ts` and desktop-specific scripts | Removes the custom runtime HTTP server and gives one desktop-aware build pipeline |
| `ELECTRON_RENDERER_URL` in development | Let `electron-vite dev` provide the renderer URL | Removes the hand-written fixed-port probe and keeps HMR |
| `loadFile()` for packaged renderer | Load `out/renderer/index.html` | No localhost server, MIME table, SPA fallback, or server lifecycle required |
| Separate main and preload output | Compile `electron/main.ts` and `electron/preload.ts` to CJS bundles | Keeps Electron/Node code out of the renderer and works with the existing sandboxed preload |
| Hidden window until first paint | `show: false` + `ready-to-show` | Avoids showing an unpainted desktop window |
| Explicit renderer isolation | Keep `contextIsolation`, `nodeIntegration: false`, and `sandbox: true` | Makes the process boundary deliberate |
| Single-instance behavior | Keep the existing lock/focus behavior | Already useful and working |
| External links leave Electron | Validate HTTP(S) before `shell.openExternal` | Keeps arbitrary window creation disabled |
| Renderer failure visibility | Log `did-fail-load` and `render-process-gone` | Gives actionable desktop failures without adding telemetry infrastructure |
| Shared renderer build settings | Reuse `createRendererConfig()` from `vite.config.ts` | Prevents desktop and web renderer builds drifting on aliases, env injection, chunks, and optimization |

## Defer until a product need exists

| Chatbox pattern | Trigger for Chang Store |
| --- | --- |
| Auto updater | Add after there is an installer/update channel. The current Windows target is portable. |
| Persistent window position/size | Add when users need restored multi-monitor/window state. |
| Native file APIs through preload | Add when a workflow needs real filesystem paths or OS dialogs. |
| Main-process network proxy | Add when gateway requests are intentionally moved out of the renderer. This is the point to remove `webSecurity: false`. |
| Packaged Playwright E2E | Add when native desktop-only behavior becomes material enough to justify a packaged acceptance suite. |
| Crash reporting/Sentry | Add only with an explicit observability/privacy decision. |
| Utility/background processes | Add when Chang Store performs sustained local CPU work that demonstrably blocks the renderer. |

## Skip

These Chatbox features solve a different product problem and should not be ported merely for architectural similarity:

- tray behavior and global shortcuts
- deep-link protocol registration
- custom frameless title bar/window controls
- TanStack Router migration
- Chatbox knowledge-base/agent/MCP runtime
- SQLite/libSQL persistence
- raw generic `ipcRenderer.invoke` exposure

The last item is intentionally excluded even though Chatbox exposes a generic invoke function. Chang Store should expose named preload capabilities only when a concrete native use case appears.

## Current limitation retained deliberately

Chang Store's image gateways are still called from the renderer and custom/local gateways may not return browser CORS headers. The desktop shell therefore keeps `webSecurity: false` for compatibility with the current networking contract. That setting should be removed when gateway transport moves behind a named main-process capability; changing it independently would break currently supported gateway configurations.

## Resulting structure

```text
electron/
  main.ts
  preload.ts

src/                  # existing React renderer remains in place
index.html
vite.config.ts        # web renderer + shared renderer config
electron.vite.config.ts

out/
  main/
  preload/
  renderer/
```

This is intentionally smaller than Chatbox's `src/main`, `src/preload`, `src/renderer` tree. Chang Store currently has only one small Electron main file and one preload file, so moving the entire React application solely to match another repository would add churn without improving the boundary.
