# Model-family prompt ownership

Gemini and GPT Image own independent prompt policy even when they share a Feature's UI,
workflow state, references, and other model-agnostic domain data. We deliberately reject
"one wording, two assemblies": the two image-model families respond differently, so each
must be free to evolve its own instructions, role framing, preservation rules, negative
guidance, and prompt structure without forcing the other to follow. Model-agnostic facts
such as an AI Scan technical blueprint may be shared as input, but each prompt family
decides independently how those facts are expressed to its model.

Amended 2026-09-27: studio invariants are the exception to "no shared wording". A rule
that must hold for every family — the untucked hemline drape (`outfitDrapePolicy.ts`) and
camera framing (`cameraFramingPolicy.ts`) — is owned once and imported verbatim, because
its failure is a domain failure rather than a styling choice. Sharing the invariant text
does not license sharing assembly: role framing, task framing, and structure stay with
each family builder.
