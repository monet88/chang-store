# E-Com Pack Workflow and Unified Clothing Transfer

We decided to integrate the full e-commerce visual pack generation (Flat Lay, Hanger, Brand Models, and Multi-Destination Try-On) directly into `ClothingTransfer` as an operational mode (`E-Com Pack`), rather than creating a separate top-level studio tab or fragmented utility buttons.

## Context

Users starting from a single model-wearing-outfit photograph previously had to jump between `ClothingTransfer`, `VirtualTryOn`, and `IdentityTransfer` to produce e-commerce catalog assets (hanging clothes, flat lays, brand-specific model shots, and diversified demographic variations). This caused repetitive image uploads and inconsistent output styling.

## Decision

1. **Host within `ClothingTransfer`**: Leverage the existing bidirectional garment extraction and transfer engine (`buildClothingTransferParts`) with an operational mode switch (`classic` vs `ecom-pack`).
2. **Garment Scope**: Enforce explicit garment item tagging (`top`, `bottom`, `outerwear`, `dress`, `full-set`) before transfer to ensure isolated or coordinated extraction without visual contamination.
3. **Hybrid Display Templates**: Provide persistent presets for Hanger and Flat Lay staging, accepting both visual Image Templates (composition reference) and Text Templates (prompt recipes) with custom user upload/input.
4. **Curated Model Roster**: Support 3 persistent brand model profiles (Linh, Trang, Mai) with dual Face + Body references and demographic metadata (age, height, weight, skin tone), while allowing dynamic multi-image destination uploads for instant outfit swapping.

## Consequences

- Keeps navigation minimal and avoids tab proliferation in Gemini Studio.
- Maximizes reuse of `imageDriverPolicy`, concurrency workers, and canvas compression.
- Extends LocalStorage persistence for user-defined templates and brand model profiles.
