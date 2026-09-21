# Semantic Judgment Layer for Fast Typed Decisions

We decided to introduce a dedicated Semantic Judgment layer powered by TypeSafe System One models (`jev-latest`) to handle discrete classification, condition verification, and semantic search across the studio, rather than coercing generative LLMs into producing unparsed prose or relying on fragile regex heuristics.

## Context

In `chang-store`, several workflows require discrete categorical decisions before synthesis:
- Virtual Try-On and Wardrobe modes require users to manually assign `sourceItemType` (`clothing`, `shoes`, `bag`, `accessory`) to each uploaded image, altering prompt rules (`hasClothing` / `hasNonClothing`).
- E-Com Pack requires explicit `garmentScopes` selection (`top`, `bottom`, `dress`, `outerwear`, `full-set`) which multiplies the target generation matrix.
- Post-processing heuristics on AI Scan blueprints relied on negative regex matching (`parseAccessoriesList`), which produced false positives on plausible LLM outputs like `"None detected"`.

Calling multimodal generative models (like Gemini) to answer simple yes/no or classification questions costs excessive latency (~2-4s), requires unneeded image tokens, and returns free-form text that must be parsed back into code. Conversely, static regex or substring search cannot handle semantic variation in user-entered notes or Vietnamese apparel terminology.

## Decision

1. **System One Decision Layer**: Integrate TypeSafe Jev as the studio's semantic judgment engine (`POST https://api.typesafe.ai/v1/systemone`), using typed primitives:
   - `Choice`: Categorical selection (e.g. `sourceItemType`, `garmentScope`) returning option probabilities and confidence.
   - `Noul`: Calibrated true/false condition probability (e.g. presence of accessories, prompt conflict verification).
   - `Score`: Rubric-based graded dimensions.
2. **The Input Ladder (Ponytail Principle)**:
   - Jev is text-only. For garment auto-classification, the engine evaluates available text first: user notes (`sourcePrompt`) or meaningful filenames (`file.name`).
   - If user text is absent and an AI Scan blueprint exists for the source set, Jev evaluates the blueprint's technical garment deconstruction.
   - Actions are confidence-gated: decisions with `confidence < 0.6` do not auto-overwrite user selections.
3. **Speculative Fan-out for Batches**:
   - Classify all source items in a batch within a single HTTP request using TypeSafe's multi-question parallel evaluation, keeping latency sub-second (~800ms) regardless of item count.
4. **Configuration & Credentials**:
   - Manage `typesafe_api_key` in client settings (`localStorage`), with development fallback to `process.env.TYPESAFE_API_KEY` mapped via `vite.config.ts`.

## Consequences

- Reduces user interaction friction: users can upload multiple garments and auto-classify them in one click.
- Fixes regex fragility by replacing prose parsing with calibrated Noul probability checks.
- Zero output token cost with sub-second execution.
- Generative models remain dedicated to image synthesis, while structural decisions route through calibrated judgment primitives.
