## 2024-05-24 - [Language Switcher Accessibility]
**Learning:** The language switcher buttons use abbreviations ("EN", "VI") which might not be pronounced clearly by screen readers. Providing full descriptive names via `aria-label` is a great way to improve accessibility for components relying on abbreviated or icon-based content.
**Action:** Always verify if text abbreviations or icons have proper, descriptive `aria-label`s for screen reader support.
