# Research Report: Flutter/Dart Rules File

Date: 2026-01-11

## Executive Summary
Prioritize official Dart/Flutter guidance. Effective Dart defines naming and doc comment rules; Dart is non-nullable by default with sound null safety. Flutter emphasizes keeping build methods cheap, using const constructors, and favoring widgets over helper functions; for lists/grids use lazy builders. State management choice depends on scope: setState/ValueNotifier for local/ephemeral; Provider/Riverpod/Bloc for app state with trade-offs. Flutter’s architecture guide recommends separation of concerns with UI and data layers (views/viewmodels, repositories, services), and an optional domain/use-case layer when complexity warrants it.

## Research Methodology
- Sources consulted: 9
- Date range of materials: 2025-08-07 to 2025-12-08
- Key search terms: Effective Dart style, Dart doc comments, Dart null safety, Flutter performance best practices, Flutter state management options, Flutter app architecture guide, StatelessWidget build performance, Provider, Bloc

## Key Findings

### 1. Dart Language Conventions (Effective Dart)
- **Naming**: types/extensions `UpperCamelCase`; methods/variables/params `lowerCamelCase`; packages/files/dirs/import prefixes `lowercase_with_underscores`.[1]
- **Constants**: prefer `lowerCamelCase` for consts/enums; allow SCREAMING_CAPS only to match existing patterns or generated code.[1]
- **Acronyms**: capitalize like words for >2 letters (Http, Nasa); keep 2-letter acronyms uppercase (ID, UI).[1]
- **Doc comments**: use `///` (not block comments); write for public APIs; start with 1-sentence summary + blank line; avoid redundancy; link identifiers with `[]`.[2]
- **Comment style**: sentence case, period endings; avoid block comments for docs; put doc comments before annotations.[2]

### 2. Null Safety Best Practices
- **Non-nullable by default**: use `?` for nullable types; prefer non-nullable unless required.[7]
- **Sound null safety**: type system guarantees non-nullable values at runtime; analyzer flags null issues early.[7]
- **Dart 3 requirement**: libraries must be null-safe; update SDK constraints and dependencies.[7]

### 3. Flutter Widget Structure & Composition
- **Stateless vs Stateful**: use StatelessWidget when UI depends only on config/context; use StatefulWidget when local mutable state needed.[4][5]
- **Build performance**: keep build small; minimize nodes; split into smaller widgets; push rebuilds to leaves; prefer widgets over helper methods.[5][3]
- **Constructors**: provide const constructors; use const widgets to short-circuit rebuild work.[3][5]
- **Key/constructor convention**: widget constructors use named params; first param is `key`, last is `child`/`children`.[5]

### 4. State Management Patterns (when to use)
- **Built-in**: `setState` for local, ephemeral widget state; ValueNotifier/InheritedNotifier for lightweight reactive state; InheritedWidget for low-level shared state.[6][4]
- **Provider**: wrapper over InheritedWidget; good default for medium apps, less boilerplate, devtools-friendly; use `create` vs `.value` correctly.[8]
- **Bloc**: predictable, event-driven architecture; suited for larger apps needing strict separation, testability, and explicit state transitions.[9]
- **Riverpod**: official site not reachable in this run (network error). Use when you need compile-time safety, testability, and provider-like ergonomics; verify from riverpod.dev.[UNRESOLVED]

### 5. Architecture Patterns
- **Flutter guide**: separate UI layer (views + view models) from data layer (repositories + services). Views are widget compositions; view models contain UI logic/state; repositories are sources of truth; services wrap external APIs.[8]
- **Domain/use-case layer**: optional; use only when logic is complex, reused, or merges multiple repos; avoid extra layer unless needed (YAGNI).[8]
- **Repository pattern**: repositories handle caching, error handling, retries, polling, and data transformations into domain models.[8]

### 6. Performance Guidelines
- **Build cost**: avoid expensive work in build; avoid high-level setState; localize rebuilds; reuse identical child widgets.[3]
- **Const**: use const constructors/widgets to reduce rebuild cost.[3][5]
- **Lists/grids**: use lazy builders (`ListView.builder`, etc.) for large lists; avoid building large off-screen child lists.[3]
- **Avoid pitfalls**: avoid overriding `operator ==` on widgets (can cause O(N^2) rebuild costs).[3]

### 7. File/Folder Structure Conventions
- **Naming**: directories/files use `lowercase_with_underscores` per Effective Dart.[1]
- **Structure**: no single official layout; common patterns align with architecture choice:
  - **Feature-first**: `features/<feature>/{view,view_model,widgets,data}`
  - **Layer-first**: `ui/`, `data/`, `domain/` with subfolders by feature
- **Rule**: pick one and keep consistent; align with separation-of-concerns guidance.[8]

## Actionable Rules (Condensed)

### Dart Style
- Use `UpperCamelCase` for types/extensions; `lowerCamelCase` for members; `lowercase_with_underscores` for files/dirs/packages/import prefixes.[1]
- Prefer `lowerCamelCase` for constants and enum values; SCREAMING_CAPS only to match existing code or generated artifacts.[1]
- Use `///` doc comments for public APIs; start with 1-sentence summary + blank line; avoid redundancy; link identifiers with `[]`.[2]
- Non-nullable by default; use `?` only when null is valid; keep code sound null-safe.[7]

### Flutter Widgets
- Prefer StatelessWidget when no local mutable state; StatefulWidget when UI changes over time or via interaction.[4][5]
- Keep `build()` cheap: split large widgets; push changing parts to leaves; prefer widgets over helper methods.[3][5]
- Use `const` constructors/widgets whenever possible.[3][5]
- Widget ctor convention: named params, `key` first, `child`/`children` last.[5]

### State Management Choice
- `setState` for local ephemeral state; ValueNotifier/InheritedWidget for lightweight shared state.[6][4]
- Provider for small–medium apps needing simple DI/reactivity and low boilerplate.[8]
- Bloc for complex apps needing explicit event/state separation, testing, and predictability.[9]
- Riverpod: verify latest guidance on riverpod.dev before codifying rules.[UNRESOLVED]

### Architecture
- Separate UI (views + view models) from data (repositories + services).[8]
- Repositories are sources of truth; services wrap external APIs; no repo-to-repo dependencies.[8]
- Add domain/use-case layer only if logic is complex/reused/merges multiple repos.[8]

### Performance
- Avoid expensive work in `build()`; localize `setState`; reuse identical widget instances.[3]
- Use const constructors/widgets widely.[3][5]
- Use lazy list/grid builders for large collections.[3]
- Avoid overriding `operator ==` on widgets except rare leaf cases.[3]

### File/Folder Structure
- Use `lowercase_with_underscores` for file/dir names.[1]
- Choose feature-first or layer-first; keep consistent with architecture and team scale.[8]

## Resources & References
- Effective Dart: Style (naming, formatting) — https://dart.dev/effective-dart/style[1]
- Effective Dart: Documentation (doc comments) — https://dart.dev/effective-dart/documentation[2]
- Dart sound null safety — https://dart.dev/null-safety[7]
- Flutter performance best practices — https://docs.flutter.dev/perf/best-practices[3]
- Flutter interactivity (stateless vs stateful) — https://docs.flutter.dev/ui/interactivity[4]
- StatelessWidget API (build/const guidance, ctor convention) — https://api.flutter.dev/flutter/widgets/StatelessWidget-class.html[5]
- Flutter state management options — https://docs.flutter.dev/data-and-backend/state-mgmt/options[6]
- Flutter app architecture guide — https://docs.flutter.dev/app-architecture/guide[8]
- Provider package docs — https://pub.dev/packages/provider[8]
- Bloc official docs — https://bloclibrary.dev/[9]

## Unresolved Questions
- Riverpod official guidance (riverpod.dev fetch failed). Should I retry to include authoritative Riverpod rules?
