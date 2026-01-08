# SRC-TAURI - Rust Desktop Backend

## OVERVIEW

Tauri 2 desktop wrapper. Minimal Rust - mostly plugin usage + 2 custom commands. Frontend calls via `invoke()`.

## STRUCTURE

```
src-tauri/
├── src/
│   ├── lib.rs    # App setup, plugins, commands (109 lines)
│   └── main.rs   # Entry point (calls lib::run())
├── gen/
│   └── schemas/  # Tauri permission schemas (auto-generated)
├── Cargo.toml    # Rust dependencies
└── tauri.conf.json # App config, window settings
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add IPC command | `src/lib.rs` → `mod commands` | + register in invoke_handler |
| Add Tauri plugin | `src/lib.rs` → `.plugin(...)` | Check tauri-plugins docs |
| Window config | `tauri.conf.json` | Size, title, permissions |
| App metadata | `tauri.conf.json` → `productName`, `version` | |

## CUSTOM COMMANDS

```rust
// Available via invoke() from frontend
save_image_to_file(base64_data: String, file_path: String) -> Result<String, String>
get_app_data_dir() -> Result<String, String>
```

## PLUGINS ENABLED

| Plugin | Purpose |
|--------|---------|
| `tauri_plugin_fs` | Read/write local files |
| `tauri_plugin_dialog` | Open/save file dialogs |
| `tauri_plugin_notification` | System notifications |
| `tauri_plugin_shell` | Open URLs in browser |

## FRONTEND IPC PATTERN

```typescript
// In services/tauriService.ts
import { invoke } from '@tauri-apps/api/core';

export async function saveImage(base64: string, path: string) {
  if (!isTauri()) return webFallback(base64, path);
  return invoke('save_image_to_file', { base64Data: base64, filePath: path });
}
```

## CONVENTIONS

- Commands in `mod commands` block
- Use `#[command]` attribute
- Return `Result<T, String>` for error handling
- Snake_case for Rust, camelCase args auto-convert

## ANTI-PATTERNS

- **NEVER** add heavy Rust logic - keep frontend-driven
- **DO NOT** bypass tauriService.ts - centralized IPC
- **DO NOT** forget hybrid fallback (`isTauri()` check)

## BUILD

```bash
npm run tauri:dev    # Dev with hot reload
npm run tauri:build  # Production .exe/.dmg/.deb
```
