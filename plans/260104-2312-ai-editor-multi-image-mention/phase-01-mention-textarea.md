# Phase 01: MentionTextarea Component

## Context Links
- Parent: [plan.md](./plan.md)
- Brainstorm: [brainstorm report](../reports/brainstorm-260104-2312-ai-editor-multi-image-mention.md)

## Overview
- **Priority:** P1 (First - standalone component)
- **Status:** Pending
- **Effort:** 1.5h
- **Description:** Create custom textarea with @mention autocomplete dropdown

## Key Insights
- Detect `@` character during typing
- Show dropdown positioned near cursor
- Display thumbnail + tag for each image option
- Insert `@imgN` on selection
- Keyboard navigation (arrow keys, enter)

## Requirements

### Functional
- Typing `@` triggers dropdown with available images
- Dropdown shows thumbnail (small) + tag label
- Click or Enter inserts `@imgN` at cursor
- Escape closes dropdown
- Arrow keys navigate options

### Non-Functional
- Memoized component (React.memo)
- No external dependencies
- Accessible (keyboard nav, aria labels)

## Architecture

```typescript
interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  images: ImageFile[];
  placeholder?: string;
  rows?: number;
  id?: string;
}

interface MentionOption {
  tag: string;      // "@img1"
  index: number;    // 0
  image: ImageFile; // For thumbnail
}
```

**State:**
```typescript
const [showDropdown, setShowDropdown] = useState(false);
const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
const [selectedIndex, setSelectedIndex] = useState(0);
const [mentionQuery, setMentionQuery] = useState('');  // Filter after @
```

## Related Code Files

### Files to Create
| File | Purpose |
|------|---------|
| `components/MentionTextarea.tsx` | Main component |

### Dependencies (Existing)
| File | Usage |
|------|-------|
| `types.ts` | `ImageFile` type |
| `contexts/LanguageContext.tsx` | Translations |

## Implementation Steps

### Step 1: Create basic component structure
```typescript
// components/MentionTextarea.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ImageFile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  images: ImageFile[];
  placeholder?: string;
  rows?: number;
  id?: string;
}

const MentionTextarea: React.FC<MentionTextareaProps> = React.memo(({
  value,
  onChange,
  images,
  placeholder,
  rows = 3,
  id,
}) => {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // ... implementation
});
```

### Step 2: Implement @ detection
```typescript
const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const newValue = e.target.value;
  const cursorPos = e.target.selectionStart;
  onChange(newValue);

  // Check if @ was just typed
  const textBeforeCursor = newValue.substring(0, cursorPos);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  if (lastAtIndex !== -1) {
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    // Show dropdown if @ is at end or followed by partial "img"
    if (textAfterAt === '' || /^img\d*$/.test(textAfterAt)) {
      setShowDropdown(true);
      calculateDropdownPosition(e.target, cursorPos);
      return;
    }
  }
  setShowDropdown(false);
}, [onChange]);
```

### Step 3: Dropdown positioning
```typescript
const calculateDropdownPosition = (textarea: HTMLTextAreaElement, cursorPos: number) => {
  // Create hidden span to measure cursor position
  const span = document.createElement('span');
  span.style.cssText = window.getComputedStyle(textarea).cssText;
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.style.whiteSpace = 'pre-wrap';
  span.textContent = textarea.value.substring(0, cursorPos);

  document.body.appendChild(span);
  const rect = textarea.getBoundingClientRect();
  // Position below cursor
  setDropdownPosition({
    top: rect.top + span.offsetHeight + 20,
    left: rect.left,
  });
  document.body.removeChild(span);
};
```

### Step 4: Dropdown UI with thumbnails
```typescript
// Generate options from images
const options: MentionOption[] = images.map((img, idx) => ({
  tag: `@img${idx + 1}`,
  index: idx,
  image: img,
}));

// Dropdown render
{showDropdown && options.length > 0 && (
  <div
    className="absolute z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
  >
    {options.map((opt, idx) => (
      <button
        key={opt.tag}
        className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-zinc-700 ${
          idx === selectedIndex ? 'bg-zinc-700' : ''
        }`}
        onClick={() => insertMention(opt.tag)}
      >
        <img
          src={`data:${opt.image.mimeType};base64,${opt.image.base64}`}
          alt={opt.tag}
          className="w-8 h-8 object-cover rounded"
        />
        <span className="text-amber-400 font-mono text-sm">{opt.tag}</span>
      </button>
    ))}
  </div>
)}
```

### Step 5: Insert mention at cursor
```typescript
const insertMention = useCallback((tag: string) => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const cursorPos = textarea.selectionStart;
  const textBeforeCursor = value.substring(0, cursorPos);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  // Replace @... with @imgN
  const newValue =
    value.substring(0, lastAtIndex) +
    tag + ' ' +
    value.substring(cursorPos);

  onChange(newValue);
  setShowDropdown(false);

  // Restore focus
  setTimeout(() => {
    textarea.focus();
    const newCursorPos = lastAtIndex + tag.length + 1;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
}, [value, onChange]);
```

### Step 6: Keyboard navigation
```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (!showDropdown) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, options.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      break;
    case 'Enter':
      e.preventDefault();
      insertMention(options[selectedIndex].tag);
      break;
    case 'Escape':
      setShowDropdown(false);
      break;
  }
}, [showDropdown, options, selectedIndex, insertMention]);
```

## Todo List

- [ ] Create `MentionTextarea.tsx` with basic structure
- [ ] Implement @ character detection
- [ ] Add dropdown positioning logic
- [ ] Render dropdown with thumbnails
- [ ] Implement mention insertion
- [ ] Add keyboard navigation
- [ ] Add React.memo and displayName
- [ ] Test with multiple images

## Success Criteria

- [ ] Typing `@` shows dropdown when images exist
- [ ] Dropdown displays thumbnails + tags correctly
- [ ] Click/Enter inserts @imgN at cursor position
- [ ] Arrow keys navigate options
- [ ] Escape closes dropdown
- [ ] No dropdown when no images uploaded

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Dropdown position off-screen | Add boundary checks, flip if needed |
| Cursor position calculation | Use simpler approach - fixed position below textarea |

## Security Considerations
- Sanitize image data for src attribute (already base64)
- No XSS risk since we control tag format

## Next Steps
- Phase 02: MultiImageUploader tag overlay
