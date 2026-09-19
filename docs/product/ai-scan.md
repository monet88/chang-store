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
4. A scan is all-or-nothing: if any required source analysis fails or returns
   unusable text, the scan resolves to `null` and no partial blueprint is
   injected.
5. The badge belongs to the source set it was given. A batch scans one set per
   job (Virtual Try-On multi-model, wardrobe, Identity Transfer), and another
   job's blueprint, spinner or failure never surfaces in this panel.
6. Changing or clearing the source images drops the badge and re-analyzes; the
   analysis of a superseded source set never labels the new one.

## Coverage

| Feature | Sources analyzed | Where the prompt carries the blueprint |
| --- | --- | --- |
| Virtual Try-On (multi-model) | one analysis per subject: the target garments, then that subject's photo | interleaved task text, both lanes |
| Virtual Try-On (wardrobe) | one analysis per set: that set's garments, then the subject | interleaved task text, both lanes |
| Lookbook | clothing images plus the fabric texture image (one slot reserved for the swatch); variations and close-ups reuse the analysis of the main they derive from | main, variation and close-up prompts |
| Identity Transfer | one analysis per destination photo | destination-side rules, both lanes |
| Pose Changer | subject photo | text and reference pose prompts |
| Background Replacer | subject photo | composed background prompt |

Analysis follows the generation: a wardrobe run analyzes each set against its
own garments, a multi-model run analyzes each subject against its own photo, and
a multi-destination Identity Transfer run analyzes each photo separately, so no
prompt is ever handed another photo's fabrics. The panel badge previews the
first source set it is given (the subject plus the first set's garments, or the
first destination).

The E-Com Pack (Clothing Transfer) runs the same analysis through its own
always-on lane and shares the analyzer prompt and the block formatter.

Out of scope by design: Watermark Remover, Pattern Generator, Photo Album and
AI Editor, which gain nothing from textile semantics.

## Configuration

- Model standard: `gemini-3.8-flash` for every scan.
- Analysis limit: the first four usable source images per scan; each source set
  is analyzed once and reused by the panel and the generation call. One slot is
  reserved for the shared reference (the subject, the model, or the lookbook
  fabric texture), so a full garment list still scans the reference it belongs
  with.
- Fail closed: one failed or unusable source report voids the whole scan, and
  the run falls back to its base prompt.

## Key Files

- `src/contexts/AiScanContext.tsx` — the persisted preference, the analysis of
  one source set and its cache
- `src/components/AiScanPanel.tsx` — the switch, and the badge / blueprint
  viewer of its own sources
- `src/utils/ai-scan-blueprint.ts` — the shared block formatter and scan
  source-set selection
- `src/services/textService.ts` → `src/services/gemini/text.ts` —
  `analyzeOutfitBlueprint`, the analyzer prompt
- `src/locales/en.ts` / `src/locales/vi.ts` — `studio.aiScan.*`

## Validation Path

- Toggle ON with a garment uploaded → analyzing badge → blueprint viewer shows
  the textile sections; the generated image's prompt carries the blueprint block.
- Toggle OFF → no analyzer call, base prompt only, no latency added.
- Analyzer failure (bad gateway key) → "unavailable" note and a normal
  generation from the base prompt; the same happens when only one source of a
  multi-image set fails, with no partial blueprint in the prompt.
