# Beads Execution Plan - Batch Watermark Remover

## Epic: cs-2o2

**Batch Watermark Remover - Xóa watermark hàng loạt**

---

## Execution Waves (Parallel Tracks)

### 🚀 Wave 1 - Foundation (3 parallel)

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL TRACK A    │  PARALLEL TRACK B    │  PARALLEL TRACK C │
│  ─────────────────   │  ─────────────────   │  ───────────────  │
│  cs-2o2.1            │  cs-2o2.2            │  cs-2o2.4         │
│  npm install jszip   │  watermark-prompts   │  types.ts         │
│  P2 | ~10min         │  P2 | ~30min         │  P2 | ~20min      │
└─────────────────────────────────────────────────────────────────┘
```

| ID | Task | Command |
|----|------|---------|
| cs-2o2.1 | Cài jszip | `npm install jszip` |
| cs-2o2.2 | Tạo utils/watermark-prompts.ts | See phase-1 |
| cs-2o2.4 | Update types.ts | See phase-1 |

**Start:** `bd update cs-2o2.1 cs-2o2.2 cs-2o2.4 --status in_progress`

---

### 🚀 Wave 2 - Utils + Hook (2 parallel)

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL TRACK A              │  PARALLEL TRACK B              │
│  ────────────────────────────  │  ────────────────────────────  │
│  cs-2o2.3                      │  cs-2o2.5 (after .2, .4 done)  │
│  utils/zipDownload.ts          │  hooks/useWatermarkRemover.ts  │
│  P2 | ~30min                   │  P1 | ~2hr                     │
│  Depends: .1                   │  Depends: .2, .3, .4           │
└─────────────────────────────────────────────────────────────────┘
```

| ID | Task | Depends On |
|----|------|------------|
| cs-2o2.3 | Tạo utils/zipDownload.ts | .1 (jszip) |
| cs-2o2.5 | Tạo hooks/useWatermarkRemover.ts | .2, .3, .4 |

**Start:** `bd update cs-2o2.3 --status in_progress` (ngay khi .1 xong)

---

### 🚀 Wave 3 - Output Component (sequential)

```
┌─────────────────────────────────────────────────────────────────┐
│  cs-2o2.6                                                       │
│  components/WatermarkRemoverOutput.tsx                          │
│  P2 | ~1.5hr                                                    │
│  Depends: .5                                                    │
└─────────────────────────────────────────────────────────────────┘
```

| ID | Task | Depends On |
|----|------|------------|
| cs-2o2.6 | Tạo WatermarkRemoverOutput.tsx | .5 (hook) |

---

### 🚀 Wave 4 - Main Component (sequential)

```
┌─────────────────────────────────────────────────────────────────┐
│  cs-2o2.7                                                       │
│  components/WatermarkRemover.tsx                                │
│  P1 | ~1.5hr                                                    │
│  Depends: .6                                                    │
└─────────────────────────────────────────────────────────────────┘
```

| ID | Task | Depends On |
|----|------|------------|
| cs-2o2.7 | Tạo WatermarkRemover.tsx | .6 (output) |

---

### 🚀 Wave 5 - Integration (2 parallel)

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL TRACK A              │  PARALLEL TRACK B              │
│  ────────────────────────────  │  ────────────────────────────  │
│  cs-2o2.8                      │  cs-2o2.9                      │
│  App.tsx integration           │  i18n strings                  │
│  P2 | ~30min                   │  P3 | ~30min                   │
│  Depends: .7                   │  Depends: .7                   │
└─────────────────────────────────────────────────────────────────┘
```

| ID | Task | Depends On |
|----|------|------------|
| cs-2o2.8 | Thêm tab vào App.tsx | .7 |
| cs-2o2.9 | Thêm i18n strings | .7 |

**Start:** `bd update cs-2o2.8 cs-2o2.9 --status in_progress` (cùng lúc)

---

### 🚀 Wave 6 - Polish (final)

```
┌─────────────────────────────────────────────────────────────────┐
│  cs-2o2.10                                                      │
│  Error handling & UX polish                                     │
│  P3 | ~1hr                                                      │
│  Depends: .8, .9                                                │
└─────────────────────────────────────────────────────────────────┘
```

| ID | Task | Depends On |
|----|------|------------|
| cs-2o2.10 | Error handling & UX | .8, .9 |

---

## Quick Reference

### All Issues

| ID | Task | P | Deps | Est |
|----|------|---|------|-----|
| cs-2o2.1 | npm install jszip | P2 | - | 10m |
| cs-2o2.2 | watermark-prompts.ts | P2 | - | 30m |
| cs-2o2.4 | types.ts | P2 | - | 20m |
| cs-2o2.3 | zipDownload.ts | P2 | .1 | 30m |
| cs-2o2.5 | useWatermarkRemover.ts | P1 | .2,.3,.4 | 2h |
| cs-2o2.6 | WatermarkRemoverOutput.tsx | P2 | .5 | 1.5h |
| cs-2o2.7 | WatermarkRemover.tsx | P1 | .6 | 1.5h |
| cs-2o2.8 | App.tsx | P2 | .7 | 30m |
| cs-2o2.9 | i18n | P3 | .7 | 30m |
| cs-2o2.10 | UX polish | P3 | .8,.9 | 1h |

### Commands

```bash
# Xem ready tasks
bd ready

# Bắt đầu task
bd update <id> --status in_progress

# Hoàn thành task
bd close <id> --reason "Done"

# Xem chi tiết
bd show <id>
```

### Optimal Execution Timeline

```
Hour 0   ├── .1 (jszip) ──────┤
         ├── .2 (prompts) ────────────┤
         ├── .4 (types) ──────────┤
Hour 1   │                    ├── .3 (zip) ────┤
         │                              ├────── .5 (hook) ──────────────────┤
Hour 3   │                                                    ├── .6 (output) ────────┤
Hour 4.5 │                                                                   ├── .7 (main) ────────┤
Hour 6   │                                                                               ├── .8 (app) ──┤
         │                                                                               ├── .9 (i18n) ─┤
Hour 7   │                                                                                        ├── .10 (polish) ─┤
Hour 8   └── DONE ──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Start Implementation

```bash
# Wave 1 - Start all 3 parallel
bd update cs-2o2.1 --status in_progress
bd update cs-2o2.2 --status in_progress
bd update cs-2o2.4 --status in_progress
```
