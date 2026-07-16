# Windows/Linux `node_modules`

Use this note when the same repo is opened from both Linux and Windows.

This repo is standardized for a Git Bash / Linux-style Node workflow.

## Why This Breaks

`node_modules` is not portable across operating systems. This repo depends on
platform-specific packages such as Rollup and esbuild, and Windows also expects
`.cmd` launchers under `node_modules/.bin`.

Typical failure mode:

- install dependencies on Linux first
- reboot into Windows and reuse the same checkout
- `vitest`, `vite`, `tsx`, or gateway test flows fail before runtime because
  Linux-native packages are still present

## Common Symptoms

- `'vitest' is not recognized as an internal or external command`
- `Cannot find module @rollup/rollup-win32-x64-msvc`
- `This platform needs the "@esbuild/win32-x64" package instead`
- PowerShell sees only extensionless symlinks in `node_modules/.bin`

## Required Rule

Treat `node_modules` as OS-local state.

- Linux checkout: install on Linux
- Windows checkout: install on Windows
- After switching OS, rebuild dependencies before running dev/build/test flows

For this repo, the preferred path is:

- run Node, Vite, Vitest, and tsx from the shell appropriate to the active OS
- on Windows, run Harness through `& '.\scripts\bin\harness-cli.exe' <command>`
  directly; do not use `scripts/harness` or Git Bash for Harness operations
- on Git Bash/Linux, run Harness through `scripts/harness`
- avoid PowerShell for normal npm/test/build flows, but use it for the required
  Windows Harness executable

## Quick Check

From the repo root:

```bash
node scripts/check-node-platform.mjs
```

The script fails fast when Rollup/esbuild native packages or Windows `.cmd`
shims do not match the active OS.

## Repair For Git Bash / Linux-Style Workflow

Use this when the checkout was last installed on Windows and now needs to run
from Git Bash / Linux-style shells:

```bash
rm -rf node_modules gateway/node_modules
npm install
npm --prefix gateway install
node scripts/check-node-platform.mjs
```

## Repair On Windows

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force gateway\node_modules -ErrorAction SilentlyContinue
npm install
npm --prefix gateway install
node scripts/check-node-platform.mjs
```

## Repair On Linux

```bash
rm -rf node_modules gateway/node_modules
npm install
npm --prefix gateway install
node scripts/check-node-platform.mjs
```

## Recommended Workflow

Best stability: keep a separate checkout per OS.

- Windows checkout for PowerShell / native Windows work
- Linux checkout for Linux-native work

If you must reuse one checkout across both OSes, rebuild dependencies every
time you switch.
