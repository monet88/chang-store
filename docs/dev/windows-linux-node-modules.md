# Windows/Linux `node_modules`

Use this note when the same repo is opened from both Linux and Windows.

Current checkout note: scripts/check-node-platform.mjs is retired or absent,
and the package test wrapper still references it. The repair commands below are
historical guidance until that tooling drift is handled separately.

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

## Quick Check

The historical platform-check script is absent in the current checkout. Use
the direct Vite/Vitest commands in docs/TEST_MATRIX.md for current proof.

## Repair For Git Bash / Linux-Style Workflow

Use this when the checkout was last installed on Windows and now needs to run
from Git Bash / Linux-style shells:

```bash
rm -rf node_modules
npm install
```

## Repair On Windows

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

## Repair On Linux

```bash
rm -rf node_modules
npm install
```

## Recommended Workflow

Best stability: keep a separate checkout per OS.

- Windows checkout for PowerShell / native Windows work
- Linux checkout for Linux-native work

If you must reuse one checkout across both OSes, rebuild dependencies every
time you switch.
