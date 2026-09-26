## 2024-09-26 - Added keyboard focus indicators to modal close buttons
**Learning:** Icon-only buttons (especially `rounded-full` ones like modal close buttons) often miss explicit keyboard focus styling, which breaks accessibility for keyboard navigation. Global defaults don't always apply correctly to fully rounded components.
**Action:** When creating or modifying modal components, always apply explicit `focus-visible` utility classes (e.g., `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`) to icon-only interactive controls.
