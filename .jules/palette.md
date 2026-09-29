## 2024-09-26 - Added keyboard focus indicators to modal close buttons
**Learning:** Icon-only buttons (especially `rounded-full` ones like modal close buttons) often miss explicit keyboard focus styling, which breaks accessibility for keyboard navigation. Global defaults don't always apply correctly to fully rounded components.
**Action:** When creating or modifying modal components, always apply explicit `focus-visible` utility classes (e.g., `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`) to icon-only interactive controls.

## 2024-05-24 - Add ARIA labels to WatermarkRemover icon buttons
**Learning:** Found several icon-only buttons in the WatermarkRemover component that were missing ARIA labels. The component used translation strings for titles (`title={t('...')}`), which is good for hover, but screen readers benefit from `aria-label`.
**Action:** Added `aria-label={t('...')}` to the "Retry", "Save to Gallery", "Download", and "Remove" icon-only buttons in `BatchItemCard`, ensuring screen reader users get the same context as mouse users.
