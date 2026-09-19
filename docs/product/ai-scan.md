# AI Scan

## Purpose

Deconstruct the source garments of a feature into a textile technical blueprint
(weave and material, optical finish, weight and drape physics, micro-edge and
hemline details) before synthesis, and splice that blueprint into the image
prompt as a subordinate specification. The layer exists so fabric, construction
and drape survive a single-pass image model that would otherwise flatten them.

## Behavior

1. The feature's options column carries a `✨ AI Scan` switch, persisted in
   `ai_scan_enabled` and ON by default.
2. With the switch ON and at least one source image uploaded, the panel starts
   the analysis immediately and shows an analyzing badge; a finished analysis
   shows a badge with an expandable blueprint viewer, or an "unavailable" note
   when the analyzer failed.
3. At generation time the feature awaits the same analysis (served from cache
   when the panel already ran it) and passes the blueprint into its prompt
   builder. A failed, cancelled or disabled analysis resolves to `null`, and the
   feature ships its base prompt — generation is never blocked by AI Scan.
4. Changing or clearing the source images drops the blueprint and re-analyzes;
   the analysis of a superseded source set never labels the new one.

## Coverage

| Feature | Sources analyzed | Where the prompt carries the blueprint |
| --- | --- | --- |
| Virtual Try-On (multi-model) | target garments, then the subject photo | interleaved task text, both lanes |
| Virtual Try-On (wardrobe) | one analysis per set: that set's garments, then the subject | interleaved task text, both lanes |
| Lookbook | clothing images, fabric texture image | main, variation and close-up prompts |
| Identity Transfer | one analysis per destination photo | destination-side rules, both lanes |
| Pose Changer | subject photo | text and reference pose prompts |
| Background Replacer | subject photo | composed background prompt |

Analysis follows the generation: a wardrobe run analyzes each set against its
own garments, and a multi-destination Identity Transfer run analyzes each photo
separately, so no prompt is ever handed another photo's fabrics. The panel badge
previews the first source set (the subject plus the first set's garments, or the
first destination) and the generation reuses that analysis from cache.

The E-Com Pack (Clothing Transfer) runs the same analysis through its own
always-on lane and shares the analyzer prompt and the block formatter.

Out of scope by design: Watermark Remover, Pattern Generator, Photo Album and
AI Editor, which gain nothing from textile semantics.

## Configuration

- Model standard: `gemini-3.8-flash` for every scan.
- Analysis limit: the first four usable source images per scan; each source set
  is analyzed once and reused by the panel and the generation call. One slot is
  reserved for the shared reference (the subject or model), so a full garment
  list still scans the subject it is worn on.
- Per-image failures are tolerated: the reports that answered are kept, and the
  scan only falls back to `null` when every source failed.

## Key Files

- `src/contexts/AiScanContext.tsx` — preference, blueprint state, analysis and
  its cache
- `src/components/AiScanPanel.tsx` — switch, status badge, blueprint viewer
- `src/utils/ai-scan-blueprint.ts` — the shared prompt block formatter
- `src/services/textService.ts` → `src/services/gemini/text.ts` —
  `analyzeOutfitBlueprint`, the analyzer prompt
- `src/locales/en.ts` / `src/locales/vi.ts` — `studio.aiScan.*`

## Validation Path

- Toggle ON with a garment uploaded → analyzing badge → blueprint viewer shows
  the textile sections; the generated image's prompt carries the blueprint block.
- Toggle OFF → no analyzer call, base prompt only, no latency added.
- Analyzer failure (bad gateway key) → "unavailable" note and a normal
  generation from the base prompt.
