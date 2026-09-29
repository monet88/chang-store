## 2024-05-24 - Add ARIA labels to WatermarkRemover icon buttons
**Learning:** Found several icon-only buttons in the WatermarkRemover component that were missing ARIA labels. The component used translation strings for titles (`title={t('...')}`), which is good for hover, but screen readers benefit from `aria-label`.
**Action:** Added `aria-label={t('...')}` to the "Retry", "Save to Gallery", "Download", and "Remove" icon-only buttons in `BatchItemCard`, ensuring screen reader users get the same context as mouse users.
