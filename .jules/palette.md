## 2024-06-10 - Invisible Focused Buttons in Overlays
**Learning:** Image hover overlays that use `opacity-0` but don't restrict `visibility` or `display` leave interactive inner buttons focusable for keyboard users, resulting in invisible elements receiving focus.
**Action:** Always add `focus-within:opacity-100` to hover overlay containers and explicit `focus-visible` rings to inner buttons to ensure keyboard users can both reach and clearly see the interactive elements.
