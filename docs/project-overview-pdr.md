# Project Overview & PDR

## Project Overview

Chang Store is an AI-powered virtual fashion studio. Users upload people,
clothing, and reference images, then generate fashion imagery through three
isolated provider studios: Gemini (default and full-featured), Grok, and GPT
Image. The product replaces parts of a photoshoot workflow with browser-based
AI tools.

## Target Audience

- Fashion e-commerce teams.
- Social/content creators.
- Designers testing outfit combinations.
- Individual users exploring virtual styling.

## Core Requirements

- Let users upload image inputs safely in the browser.
- Generate fashion outputs through Gemini image models or the isolated Grok and
  GPT Image provider studios.
- Keep feature UIs fast and understandable.
- Persist outputs locally in the browser gallery.
- Support English and Vietnamese UI strings.
- Keep deployment as a static Vite SPA.

## Core Features

| Feature | Requirement |
| --- | --- |
| Virtual Try-On | Dress subject images in clothing items |
| Lookbook | Generate editorial/product fashion spreads |
| Background | Replace backgrounds with prompts or presets |
| Pose | Change subject pose from references or library poses |
| Photo Album | Batch-create themed album images |
| AI Editor | Free-form image editing with prompt and @mentions |
| Watermark Remover | Batch remove watermarks with retry/download flows |
| Clothing Transfer | Transfer worn clothing from source to target person |
| Pattern Generator | Generate and refine textile/fabric patterns |

## Non-Functional Requirements

- TypeScript compile cleanly.
- Components remain thin; hooks own business logic.
- API keys are provided by environment/runtime config, never hardcoded.
- User-facing text goes through i18n.
- Generated images are downloadable and storable.

## References

- `docs/product/overview.md`
- `docs/product/*.md`
- `docs/ARCHITECTURE.md`
- `docs/code-standards.md`
