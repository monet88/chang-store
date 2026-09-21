## 2024-05-14 - Optimize GptImageOptionsPanel Component
**Learning:** Found that `GptImageOptionsPanel` was missing `React.memo` while its Gemini counterpart `ImageOptionsPanel` was correctly memoized. Parent components like `GptLookbookForm` update frequently on form state changes causing unnecessary re-renders of the options panel.
**Action:** When adding or maintaining UI components like form option panels that take stable props, ensure they are wrapped in `React.memo` to prevent cascading re-renders during state updates in parent components.
