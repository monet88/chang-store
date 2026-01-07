# Phase 4: Integration

**Estimated**: 1 hour

## Tasks

### 4.1 Update App.tsx

Add WatermarkRemover to the tabs:

```typescript
// Add import
import WatermarkRemover from './components/WatermarkRemover';

// Add to TABS array (find appropriate position)
{
  id: 'watermark-remover',
  labelKey: 'tabs.watermarkRemover',
  icon: '🧹', // or use an eraser/magic wand icon
  component: WatermarkRemover,
},
```

### 4.2 Update locales/en.ts

Add watermarkRemover section:

```typescript
watermarkRemover: {
  // Tab
  title: 'Watermark Remover',
  description: 'Batch remove text, logos, and watermarks from images using AI',
  
  // Inputs
  uploadImages: 'Upload Images',
  selectModel: 'Select AI Model',
  selectPrompt: 'Select Prompt',
  customPrompt: 'Custom Prompt',
  prompt: 'Prompt',
  promptPlaceholder: 'Enter your custom prompt...',
  concurrency: 'Parallel Processing',
  startProcessing: 'Start Processing',
  processing: 'Processing...',
  clearAll: 'Clear All',
  
  // Prompts
  'prompt.text-logo': 'Text & Logo Removal',
  'prompt.clean': 'Clean Version',
  'prompt.safe': 'Safe & Neutral',
  'prompt.artistic': 'Artistic/Pattern',
  'prompt.quick': 'Quick & Simple',
  
  // Output
  noImages: 'Upload images to start',
  pending: 'Waiting...',
  samePrompt: 'Same prompt',
  save: 'Save to Gallery',
  download: 'Download',
  saveAll: 'Save All to Gallery',
  downloadZip: 'Download All (ZIP)',
  retry: 'Retry',
},

// Add to tabs section
tabs: {
  // ... existing tabs
  watermarkRemover: 'Watermark Remover',
},
```

### 4.3 Update locales/vi.ts

Add Vietnamese translations:

```typescript
watermarkRemover: {
  // Tab
  title: 'Xoa Watermark',
  description: 'Xoa hang loat chu, logo va watermark tren anh bang AI',
  
  // Inputs
  uploadImages: 'Tai anh len',
  selectModel: 'Chon Model AI',
  selectPrompt: 'Chon Prompt',
  customPrompt: 'Prompt Tuy Chinh',
  prompt: 'Prompt',
  promptPlaceholder: 'Nhap prompt cua ban...',
  concurrency: 'Xu ly song song',
  startProcessing: 'Bat dau xu ly',
  processing: 'Dang xu ly...',
  clearAll: 'Xoa tat ca',
  
  // Prompts
  'prompt.text-logo': 'Xoa chu & Logo',
  'prompt.clean': 'Phien ban sach',
  'prompt.safe': 'An toan & Trung tinh',
  'prompt.artistic': 'Nghe thuat/Hoa van',
  'prompt.quick': 'Nhanh & Don gian',
  
  // Output
  noImages: 'Tai anh len de bat dau',
  pending: 'Cho xu ly...',
  samePrompt: 'Giu nguyen prompt',
  save: 'Luu vao thu vien',
  download: 'Tai xuong',
  saveAll: 'Luu tat ca',
  downloadZip: 'Tai tat ca (ZIP)',
  retry: 'Thu lai',
},

// Add to tabs section
tabs: {
  // ... existing tabs
  watermarkRemover: 'Xoa Watermark',
},
```

## Checklist

- [ ] Add WatermarkRemover import to App.tsx
- [ ] Add tab configuration to TABS array
- [ ] Add English translations to locales/en.ts
- [ ] Add Vietnamese translations to locales/vi.ts
- [ ] Verify tab appears in sidebar
- [ ] Test language switching
