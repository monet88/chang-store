# Remove Tauri - Web Only

**Date:** 2026-01-21
**Status:** Approved

## Overview

Loại bỏ hoàn toàn Tauri desktop wrapper, chuyển project thành web-only application.

## Rationale

- Tauri chỉ được dùng như wrapper, không sử dụng native features
- Giảm complexity và maintenance burden
- Focus vào web platform

## Scope

### Complete Removal

**Xóa hoàn toàn:**
- `src-tauri/` folder (Rust backend)
- Tauri dependencies trong `package.json`
- Tauri scripts (`tauri:dev`, `tauri:build`)

**Cleanup source code:**
- Imports từ `@tauri-apps/*`
- Service files liên quan Tauri
- Conditional Tauri code (`window.__TAURI__`)

**Update documentation:**
- `CLAUDE.md` - Xóa Tauri commands section
- Các docs đề cập desktop app
- `.gitignore` Tauri entries

## Execution Steps

1. Xóa `src-tauri/` folder
2. Clean `package.json` (deps + scripts)
3. Scan & remove Tauri imports trong source
4. Update docs
5. Verify build & lint

## Verification

- [ ] `npm run build` passes
- [ ] `npm run dev` works
- [ ] `npm run lint` clean
- [ ] No "tauri" references in codebase (grep)

## Risk

**Low risk** - Tauri là wrapper only, không có native feature dependencies.
