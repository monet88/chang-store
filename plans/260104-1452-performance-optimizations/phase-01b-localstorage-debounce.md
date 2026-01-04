# Phase 01b: LocalStorage Debounce + Lodash Tree-Shaking

**Agent Type:** fullstack-developer
**Priority:** P0 Critical
**Estimated Time:** 1h
**Issue Reference:** ISSUE 6 + Lodash optimization from performance report

---

## Objectives

1. **Fix LocalStorage bottleneck:** Debounce writes to eliminate 200ms typing lag
2. **Optimize bundle size:** Replace full lodash with tree-shakeable lodash-es (-60KB)

**Performance Impact:**
- Typing lag: 200ms → 0ms (10 keystrokes × 20ms eliminated)
- Bundle size: -60KB gzipped
- User experience: Smooth form input, no perceived delay

---

## Current Problem

```typescript
// hooks/useLookbookGenerator.ts:90-94
useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formState)); // ❌ 5-15ms sync I/O
  }
}, [formState]); // ⚠️ Triggers on ANY nested property change
```

**Issues:**
1. Synchronous localStorage write blocks UI thread (5-15ms)
2. JSON.stringify adds 2-5ms for large state
3. Triggers on every keystroke in form inputs
4. Cumulative: 10 keystrokes = 10 × 20ms = 200ms total lag

**Bundle Issue:**
```json
// package.json
"dependencies": {
  "lodash": "^4.17.21", // ❌ Imports entire 70KB library
}
```

---

## Implementation Tasks

### Task 1: Replace lodash with lodash-es

**Install lodash-es:**
```bash
npm uninstall lodash
npm install lodash-es
npm install --save-dev @types/lodash-es
```

**Update package.json:**
```json
{
  "dependencies": {
    "@google/genai": "^1.17.0",
    "lodash-es": "^4.17.21",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@types/lodash-es": "^4.17.12",
    "@types/node": "^22.14.0",
    // ... other devDeps
  }
}
```

---

### Task 2: Update Import Syntax (Tree-Shakeable)

```typescript
// hooks/useLookbookGenerator.ts
// ❌ OLD: import { debounce } from 'lodash';
// ✅ NEW: Tree-shakeable import
import debounce from 'lodash-es/debounce';
```

**Why:** Individual function import allows Vite to tree-shake unused lodash functions

---

### Task 3: Implement Debounced LocalStorage Save

```typescript
// hooks/useLookbookGenerator.ts:90-94

const debouncedSave = useMemo(
  () => debounce((state: LookbookFormState) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save draft to localStorage:', error);
        // Silently fail - draft saving is non-critical
      }
    }
  }, 1000), // 1 second debounce - balance between UX and data safety
  []
);

useEffect(() => {
  debouncedSave(formState);

  // Cleanup: cancel pending debounced calls on unmount
  return () => {
    debouncedSave.cancel();
  };
}, [formState, debouncedSave]);
```

**Key Points:**
- **1000ms debounce:** User stops typing → save after 1 second
- **Cleanup:** Cancel pending saves on component unmount (prevents memory leaks)
- **Error handling:** LocalStorage can fail (quota exceeded, private browsing)
- **useMemo:** Debounced function created once, not on every render

---

### Task 4: Verify Draft Restoration Still Works

```typescript
// Initialization should remain unchanged
const [formState, setFormState] = useState<LookbookFormState>(() => {
  if (typeof window === 'undefined') {
    return initialFormState;
  }
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialFormState;
  } catch {
    return initialFormState;
  }
});
```

**No changes needed** - initialization reads from localStorage synchronously (one-time cost on mount)

---

## Files to Modify

**Primary File:**
- `hooks/useLookbookGenerator.ts` (lines 1-4 for import, lines 90-94 for debounce)

**Configuration File:**
- `package.json` (dependencies section)

**Search for Other Lodash Imports:**
```bash
# Check if lodash is used elsewhere
grep -r "from 'lodash'" --include="*.ts" --include="*.tsx"
```

**If found:** Update all imports to tree-shakeable syntax

---

## Implementation Checklist

- [ ] Uninstall lodash package
- [ ] Install lodash-es and @types/lodash-es
- [ ] Update import to `import debounce from 'lodash-es/debounce'`
- [ ] Wrap debounce in useMemo (create once)
- [ ] Implement 1000ms debounce delay
- [ ] Add cleanup (debounce.cancel) in useEffect return
- [ ] Add try-catch for localStorage errors
- [ ] Search codebase for other lodash imports
- [ ] Update any other lodash imports to tree-shakeable syntax
- [ ] Verify package-lock.json updated (no lodash, has lodash-es)

---

## Testing Requirements

### Functional Testing
1. **Draft Save:**
   - Type in Lookbook form fields
   - Wait 1 second
   - Refresh page
   - Verify form state restored

2. **Rapid Typing:**
   - Type quickly in "clothing description" field
   - Verify no lag (should feel instant)
   - Wait 1 second after stopping
   - Verify draft saved (check localStorage in DevTools)

3. **Component Unmount:**
   - Fill out form
   - Switch to different feature (unmount Lookbook)
   - Return to Lookbook
   - Verify draft restored

### Bundle Size Verification
```bash
npm run build
# Check dist/ folder size

# OR use build analyzer
npm run build:analyze
# Verify lodash-es chunk size ~10KB (only debounce function)
# NOT ~70KB (full library)
```

### localStorage DevTools Check
1. Open Chrome DevTools → Application tab → Local Storage
2. Type in form
3. Watch `lookbookGeneratorDraft` key
4. Should update ~1 second after typing stops (not on every keystroke)

---

## Acceptance Criteria

✅ **lodash replaced with lodash-es in package.json**
✅ **debounce imported using tree-shakeable syntax**
✅ **localStorage writes debounced (1000ms delay)**
✅ **No typing lag in Lookbook form**
✅ **Draft restoration works on page refresh**
✅ **Component unmount cleans up debounced calls**
✅ **Bundle size reduced by ~60KB** (verify with build:analyze)
✅ **No console errors or warnings**
✅ **All other lodash imports updated (if any)**

---

## Performance Verification

**Before (Baseline):**
```javascript
// Type 10 characters in "clothing description"
// Each keystroke: 20ms UI freeze
// Total: 200ms cumulative lag
// User perception: "Sluggish typing"
```

**After (Target):**
```javascript
// Type 10 characters in "clothing description"
// Each keystroke: 0ms lag (debounced)
// localStorage write happens once, 1 second after typing stops
// User perception: "Instant, smooth"
```

**Bundle Size:**
```bash
# Before: lodash in vendor chunk = ~70KB
# After: lodash-es/debounce only = ~10KB
# Savings: -60KB gzipped
```

---

## Edge Cases to Handle

### 1. LocalStorage Quota Exceeded
```typescript
try {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
} catch (error) {
  console.error('Failed to save draft:', error);
  // Don't crash - draft saving is non-critical
}
```

### 2. Private Browsing Mode
- localStorage may throw on write
- try-catch handles this gracefully

### 3. Rapid Feature Switching
- Cleanup cancels pending saves
- No orphaned debounced calls

---

## Rollback Plan

If issues arise:
```bash
npm uninstall lodash-es @types/lodash-es
npm install lodash@^4.17.21
git checkout hooks/useLookbookGenerator.ts
git checkout package.json
```

---

## Additional Notes

**Why 1000ms debounce?**
- 500ms: Too short, may still cause unnecessary writes
- 1000ms: Good balance - user pauses briefly, save happens
- 2000ms: Too long, user may lose work if crash occurs

**Why useMemo for debounce?**
- Debounce function must be stable across re-renders
- If recreated every render, debouncing won't work (new timer each time)

**Future Enhancement (Optional):**
- Consider `requestIdleCallback` for even better performance
- Save only when browser is idle, not on fixed timer

---

**Status:** Ready for implementation
**Agent:** fullstack-developer-1b
