## 2024-06-10 - Invisible Focused Buttons in Overlays
**Learning:** Image hover overlays that use `opacity-0` but don't restrict `visibility` or `display` leave interactive inner buttons focusable for keyboard users, resulting in invisible elements receiving focus.
**Action:** Always add `focus-within:opacity-100` to hover overlay containers and explicit `focus-visible` rings to inner buttons to ensure keyboard users can both reach and clearly see the interactive elements.
## 2024-05-24 - [Language Switcher Accessibility]
**Learning:** The language switcher buttons use abbreviations ("EN", "VI") which might not be pronounced clearly by screen readers. Providing full descriptive names via `aria-label` is a great way to improve accessibility for components relying on abbreviated or icon-based content.
**Action:** Always verify if text abbreviations or icons have proper, descriptive `aria-label`s for screen reader support.
## 2025-06-29 - [Added `focus-visible` to interactive elements in `WatermarkRemover`]
**Learning:** Adding keyboard focus indicators ensures that keyboard users have visual feedback to see what they are navigating over in a complex component like `WatermarkRemover`. It's essential to match the focus ring color to the theme context of the element to make it visible and not jarring.
**Action:** When creating interactive UI components like buttons, input fields, and tabs, ensure `focus-visible:outline-none focus-visible:ring-2` (and optionally a ring color like `focus-visible:ring-amber-500` or `focus-visible:ring-white`) are applied to make the component keyboard accessible.
