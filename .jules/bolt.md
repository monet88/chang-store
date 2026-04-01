## 2026-04-01 - Wrap ImageOptionsPanel with React.memo
**Learning:** Shared UI components used across many views (e.g. 9 features) can cause widespread unnecessary re-renders if they don't use `React.memo`. `ImageOptionsPanel` (and its child components `AspectRatioSelector` and `ResolutionSelector`) were pure presentational components taking props like `aspectRatio` and `resolution`.
**Action:** Wrapped these components in `React.memo` to prevent them from re-rendering whenever the parent component updates its internal state unrelated to these options.
