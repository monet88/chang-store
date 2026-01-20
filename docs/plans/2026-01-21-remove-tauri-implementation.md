# Remove Tauri - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely remove Tauri desktop wrapper, converting project to web-only.

**Architecture:** Delete src-tauri folder, remove all Tauri dependencies and related code from source files, update all documentation to reflect web-only status.

**Tech Stack:** React 19, Vite, TypeScript (no Tauri)

---

## Task 1: Delete src-tauri Folder

**Files:**
- Delete: `src-tauri/` (entire folder)

**Step 1: Remove the folder**

```bash
rm -rf src-tauri/
```

**Step 2: Verify deletion**

Run: `ls src-tauri/ 2>&1`
Expected: "No such file or directory"

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove src-tauri folder"
```

---

## Task 2: Clean package.json

**Files:**
- Modify: `package.json`

**Step 1: Remove Tauri scripts**

Remove these lines from `scripts`:
```json
"tauri": "tauri",
"tauri:dev": "tauri dev",
"tauri:build": "tauri build",
"tauri:icon": "tauri icon"
```

**Step 2: Remove Tauri dependencies**

Remove from `dependencies`:
```json
"@tauri-apps/api": "^2.9.1",
"@tauri-apps/plugin-dialog": "^2.4.2",
"@tauri-apps/plugin-fs": "^2.4.4",
"@tauri-apps/plugin-notification": "^2.3.3",
"@tauri-apps/plugin-shell": "^2.3.3",
```

Remove from `devDependencies`:
```json
"@tauri-apps/cli": "^2.9.6",
```

**Step 3: Regenerate lock file**

Run: `npm install`
Expected: Clean install without Tauri packages

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove Tauri dependencies from package.json"
```

---

## Task 3: Delete tauriService.ts

**Files:**
- Delete: `services/tauriService.ts`
- Delete: `coverage/services/tauriService.ts.html` (if exists)

**Step 1: Delete service file**

```bash
rm services/tauriService.ts
rm -f coverage/services/tauriService.ts.html
```

**Step 2: Verify no imports remain**

Run: `grep -r "tauriService" --include="*.ts" --include="*.tsx" .`
Expected: No matches (empty output)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove tauriService.ts"
```

---

## Task 4: Clean vite.config.ts

**Files:**
- Modify: `vite.config.ts`

**Step 1: Remove Tauri from watch.ignored**

Remove this line from `server.watch.ignored`:
```typescript
'**/src-tauri/target/**',
```

**Step 2: Remove Tauri from optimizeDeps.exclude**

Remove this line from `optimizeDeps.exclude`:
```typescript
exclude: ['@tauri-apps/api', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-fs'],
```

(Delete the entire `exclude` array since it only contained Tauri packages)

**Step 3: Verify config is valid**

Run: `npm run dev`
Expected: Dev server starts without errors

Stop dev server (Ctrl+C)

**Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "chore: remove Tauri references from vite.config.ts"
```

---

## Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update Project Overview**

Change:
```markdown
AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with dual AI backends (Google Gemini, AIVideoAuto). Desktop app via Tauri 2.
```

To:
```markdown
AI-powered virtual fashion studio. React 19 + TypeScript + Vite SPA with dual AI backends (Google Gemini, AIVideoAuto).
```

**Step 2: Remove Desktop (Tauri) commands section**

Remove these lines from Commands section:
```markdown
# Desktop (Tauri)
npm run tauri:dev     # Desktop app with hot reload
npm run tauri:build   # Build installers (.exe, .msi)
```

**Step 3: Update Directory Structure table**

Remove this row:
```markdown
| `src-tauri/` | Tauri desktop app (Rust backend) |
```

**Step 4: Update services description**

Change:
```markdown
| `services/` | API integrations: Gemini, AIVideoAuto, Tauri |
```

To:
```markdown
| `services/` | API integrations: Gemini, AIVideoAuto |
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: remove Tauri references from CLAUDE.md"
```

---

## Task 6: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

**Step 1: Update Overview**

Change:
```markdown
Chang-Store is a React 19 + Vite SPA with an optional Tauri 2 desktop shell.
```

To:
```markdown
Chang-Store is a React 19 + Vite SPA.
```

**Step 2: Remove src-tauri from Structure**

Remove this line:
```markdown
├── src-tauri/                  # Tauri shell (Rust)
```

**Step 3: Remove Native calls row from WHERE TO LOOK table**

Remove:
```markdown
| Native calls | `src-tauri/` + `tauriService.ts` | Always guard with `isTauri` |
```

**Step 4: Remove Tauri style from UNIQUE STYLES**

Remove:
```markdown
- Tauri calls go through `tauriService.ts` with `isTauri` fallback.
```

**Step 5: Remove tauri:dev from COMMANDS**

Remove:
```markdown
npm run tauri:dev    # Desktop dev
```

**Step 6: Commit**

```bash
git add AGENTS.md
git commit -m "docs: remove Tauri references from AGENTS.md"
```

---

## Task 7: Final Verification

**Step 1: Search for remaining Tauri references**

Run: `grep -ri "tauri" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json" . | grep -v node_modules | grep -v ".git" | grep -v "remove-tauri"`
Expected: No matches (or only in plan docs)

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Run tests**

Run: `npm run test`
Expected: All tests pass

**Step 5: Final commit (if any remaining changes)**

```bash
git status
# If clean, skip. Otherwise:
git add -A
git commit -m "chore: final cleanup after Tauri removal"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Delete src-tauri folder |
| 2 | Clean package.json (deps + scripts) |
| 3 | Delete tauriService.ts |
| 4 | Clean vite.config.ts |
| 5 | Update CLAUDE.md |
| 6 | Update AGENTS.md |
| 7 | Final verification |

**Total: 7 tasks, ~15-20 minutes**
