# Phase 5: Polish

**Estimated**: 1 hour

## Tasks

### 5.1 Error Handling Improvements

Add better error messages and handling:

```typescript
// In useWatermarkRemover.ts - processItem function

// Add specific error handling
try {
  // ... existing code
} catch (error) {
  let errorMsg = 'Processing failed';
  
  if (error instanceof Error) {
    // Parse common Gemini errors
    if (error.message.includes('RATE_LIMIT')) {
      errorMsg = 'Rate limit exceeded. Try reducing concurrency.';
    } else if (error.message.includes('SAFETY')) {
      errorMsg = 'Content blocked by safety filter.';
    } else if (error.message.includes('TIMEOUT')) {
      errorMsg = 'Request timed out. Try again.';
    } else {
      errorMsg = error.message;
    }
  }
  
  // Update item with error
  setItems(prev => prev.map(i => 
    i.id === item.id ? { ...i, status: 'error', progress: 0, error: errorMsg } : i
  ));
}
```

### 5.2 Progress Tracking

Add more granular progress updates:

```typescript
// In processItem - simulate progress during API call
const progressInterval = setInterval(() => {
  setItems(prev => prev.map(i => 
    i.id === item.id && i.status === 'processing' && i.progress < 90
      ? { ...i, progress: Math.min(90, i.progress + 10) }
      : i
  ));
}, 500);

try {
  const results = await editImage({ /* ... */ });
  clearInterval(progressInterval);
  // ... success handling
} catch (error) {
  clearInterval(progressInterval);
  // ... error handling
}
```

### 5.3 UX Enhancements

**Confirmation dialogs:**
```typescript
// Clear all confirmation
const handleClearAll = () => {
  if (items.length > 0 && window.confirm(t('watermarkRemover.confirmClear'))) {
    clearAll();
  }
};
```

**Batch completion notification:**
```typescript
// In startProcessing - after completion
const successCount = items.filter(i => i.status === 'success').length;
const errorCount = items.filter(i => i.status === 'error').length;

// Show toast or alert
alert(t('watermarkRemover.batchComplete', { success: successCount, error: errorCount }));
```

**Keyboard shortcuts:**
```typescript
// Optional: Add keyboard support
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter' && canStart) {
      startProcessing();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [canStart, startProcessing]);
```

### 5.4 Performance Optimizations

**Memoization:**
```typescript
// Memoize expensive computations
const successItems = useMemo(
  () => items.filter(i => i.status === 'success'),
  [items]
);

const pendingCount = useMemo(
  () => items.filter(i => i.status === 'pending').length,
  [items]
);
```

**Virtualization (optional, for large batches):**
```typescript
// If handling 100+ images, consider react-window
// import { FixedSizeGrid } from 'react-window';
```

### 5.5 Accessibility

```typescript
// Add ARIA labels
<button
  onClick={startProcessing}
  disabled={!canStart}
  aria-busy={isProcessing}
  aria-label={t('watermarkRemover.startProcessing')}
>
  {/* ... */}
</button>

// Progress announcement
<div 
  role="status" 
  aria-live="polite"
  className="sr-only"
>
  {isProcessing && `Processing ${completedCount} of ${totalCount}`}
</div>
```

### 5.6 Additional i18n Strings

```typescript
// Add to locales
watermarkRemover: {
  // ... existing
  confirmClear: 'Clear all images?',
  batchComplete: 'Completed: {success} success, {error} failed',
  ctrlEnterHint: 'Ctrl+Enter to start',
},
```

## Testing Checklist

- [ ] Upload 1 image - processes correctly
- [ ] Upload 10 images - parallel processing works
- [ ] Upload 20+ images - concurrency limit respected
- [ ] Error handling - failed image shows retry
- [ ] Retry with different prompt - works
- [ ] Save to gallery - appears in gallery
- [ ] Download individual - file downloads
- [ ] Download ZIP - all successful images in ZIP
- [ ] Clear all - confirmation shown, clears queue
- [ ] Language switch - all strings translated
- [ ] Model switch - uses correct model

## Known Limitations

1. No offline support - requires API connection
2. Large images may timeout - consider adding compression
3. No resume after page refresh - queue is in memory

## Future Enhancements (Out of Scope)

- [ ] Save queue to localStorage for resume
- [ ] Add image compression option
- [ ] Add before/after comparison view
- [ ] Add batch rename for downloaded files
- [ ] Add progress persistence
