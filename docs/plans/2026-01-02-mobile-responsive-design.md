# Mobile Responsive Design Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Chang-Store fully responsive on mobile devices with hamburger menu sidebar and optimized feature layouts.

**Architecture:** Phased approach - Phase 1 focuses on sidebar/layout (hamburger menu with overlay), Phase 2 audits feature components. State management via `isSidebarOpen` in App.tsx, responsive breakpoint at `lg` (1024px).

**Tech Stack:** React, TypeScript, Tailwind CSS (via CDN)

---

## Phase 1: Sidebar & Layout Responsive

### Task 1: Add Sidebar State to App.tsx

**Files:**
- Modify: `App.tsx:44-46`

**Step 1: Add isSidebarOpen state**

Add after line 47 (after `imageToEdit` state):

```typescript
const [isSidebarOpen, setIsSidebarOpen] = useState(false);
```

**Step 2: Add toggle and close handlers**

Add after `handleCloseEditor` callback (around line 80):

```typescript
const handleToggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), []);
```

**Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(responsive): add sidebar open state for mobile menu"
```

---

### Task 2: Create Mobile Menu Button Component

**Files:**
- Create: `components/MobileMenuButton.tsx`

**Step 1: Create the component**

```typescript
/**
 * Mobile hamburger menu button
 *
 * Visible only on screens < lg (1024px).
 * Toggles sidebar visibility on mobile devices.
 */

import React from 'react';

interface MobileMenuButtonProps {
  onClick: () => void;
}

const MobileMenuButton: React.FC<MobileMenuButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
      aria-label="Toggle menu"
    >
      {/* Hamburger icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      </svg>
    </button>
  );
};

export default MobileMenuButton;
```

**Step 2: Verify file created**

Run: `ls components/MobileMenuButton.tsx`
Expected: File exists

**Step 3: Commit**

```bash
git add components/MobileMenuButton.tsx
git commit -m "feat(responsive): add MobileMenuButton component"
```

---

### Task 3: Create Mobile Overlay Component

**Files:**
- Create: `components/MobileOverlay.tsx`

**Step 1: Create the component**

```typescript
/**
 * Semi-transparent overlay for mobile sidebar
 *
 * Appears behind sidebar when open on mobile.
 * Click to close sidebar.
 */

import React from 'react';

interface MobileOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileOverlay: React.FC<MobileOverlayProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="lg:hidden fixed inset-0 z-20 bg-black/50 backdrop-blur-sm transition-opacity"
      onClick={onClose}
      aria-hidden="true"
    />
  );
};

export default MobileOverlay;
```

**Step 2: Commit**

```bash
git add components/MobileOverlay.tsx
git commit -m "feat(responsive): add MobileOverlay component"
```

---

### Task 4: Update Header.tsx for Responsive Sidebar

**Files:**
- Modify: `components/Header.tsx`

**Step 1: Update props interface**

Replace line 11-15:

```typescript
interface HeaderProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
}
```

**Step 2: Update component signature**

Replace line 17:

```typescript
const Header: React.FC<HeaderProps> = ({ activeFeature, setActiveFeature, onOpenSettings, isOpen, onClose }) => {
```

**Step 3: Update aside element classes**

Replace line 20 (the aside tag):

```typescript
    <aside className={`
      fixed top-0 left-0 z-30 h-screen w-72 flex flex-col p-4
      bg-slate-950/80 backdrop-blur-2xl border-r border-slate-800 shadow-2xl
      transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0
    `}>
```

**Step 4: Add close button for mobile (inside aside, at top)**

Add after the opening aside tag (line 20), before the first div:

```typescript
      {/* Close button for mobile */}
      <button
        onClick={onClose}
        className="lg:hidden absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
        aria-label="Close menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
```

**Step 5: Auto-close sidebar when feature selected (wrap setActiveFeature in Tabs)**

This will be handled in App.tsx by passing a wrapped handler.

**Step 6: Commit**

```bash
git add components/Header.tsx
git commit -m "feat(responsive): make Header sidebar responsive with slide animation"
```

---

### Task 5: Update App.tsx Layout and Integrate Components

**Files:**
- Modify: `App.tsx`

**Step 1: Add imports**

Add after line 12 (after Spinner import):

```typescript
import MobileMenuButton from './components/MobileMenuButton';
import MobileOverlay from './components/MobileOverlay';
```

**Step 2: Create wrapped setActiveFeature handler**

Add after `handleCloseSidebar` (around line 82):

```typescript
// Auto-close sidebar when feature is selected on mobile
const handleSetActiveFeature = useCallback((feature: Feature) => {
  setActiveFeature(feature);
  setIsSidebarOpen(false);
}, []);
```

**Step 3: Update Header component usage**

Replace line 120:

```typescript
<Header
  activeFeature={activeFeature}
  setActiveFeature={handleSetActiveFeature}
  onOpenSettings={handleOpenSettings}
  isOpen={isSidebarOpen}
  onClose={handleCloseSidebar}
/>
```

**Step 4: Add MobileMenuButton and MobileOverlay**

Add after Header (after line 120):

```typescript
<MobileMenuButton onClick={handleToggleSidebar} />
<MobileOverlay isOpen={isSidebarOpen} onClose={handleCloseSidebar} />
```

**Step 5: Update main content div for responsive margin**

Replace line 121:

```typescript
<div className="flex-1 flex flex-col lg:ml-72 h-screen overflow-hidden">
```

**Step 6: Run dev server and test**

Run: `npm run dev`
Test: Resize browser to < 1024px, verify hamburger appears, sidebar slides, overlay works

**Step 7: Commit**

```bash
git add App.tsx
git commit -m "feat(responsive): integrate mobile menu, overlay, and responsive layout"
```

---

### Task 6: Build Verification

**Step 1: Run build**

Run: `npm run build`
Expected: Build completes without errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors

**Step 3: Commit if any fixes needed**

```bash
git add .
git commit -m "fix(responsive): address lint/build issues"
```

---

## Phase 2: Feature Components Audit

### Task 7: Audit VirtualTryOn.tsx

**Files:**
- Review: `components/VirtualTryOn.tsx`

**Step 1: Review grid layout**

Check for responsive grid classes like `grid-cols-1 lg:grid-cols-2`

**Step 2: Verify spacing on mobile**

Check padding/margin values work on small screens

**Step 3: Test on mobile viewport**

Run dev server, resize to 375px width, verify usability

**Step 4: Fix issues if found**

Apply mobile-first adjustments as needed

**Step 5: Commit fixes**

```bash
git add components/VirtualTryOn.tsx
git commit -m "fix(responsive): improve VirtualTryOn mobile layout"
```

---

### Task 8: Audit Other Feature Components

**Files to review:**
- `components/LookbookGenerator.tsx`
- `components/BackgroundReplacer.tsx`
- `components/PoseChanger.tsx`
- `components/SwapFace.tsx`
- `components/PhotoAlbumCreator.tsx`
- `components/OutfitAnalysis.tsx`
- `components/Relight.tsx`
- `components/Upscale.tsx`
- `components/VideoGenerator.tsx`
- `components/VideoContinuity.tsx`
- `components/Inpainting.tsx`
- `components/GRWMVideoGenerator.tsx`

**Step 1: Batch review components**

For each component, check:
- Grid responsive classes
- Text sizing on mobile
- Touch target sizes (min 44px)
- Image containers scale properly

**Step 2: Fix common patterns**

Apply consistent responsive patterns:
- `grid-cols-1 lg:grid-cols-2` for two-column layouts
- `text-sm sm:text-base` for text scaling
- `p-3 sm:p-4 lg:p-6` for padding scaling

**Step 3: Commit by logical groups**

```bash
git add components/
git commit -m "fix(responsive): improve feature components mobile layouts"
```

---

### Task 9: Audit Modal Components

**Files:**
- `components/modals/GalleryModal.tsx`
- `components/modals/SettingsModal.tsx`
- `components/modals/PoseLibraryModal.tsx`

**Step 1: Check modal sizing**

Ensure modals use responsive width: `w-full max-w-lg` or similar

**Step 2: Check scrolling**

Modals should be scrollable on mobile: `max-h-[90vh] overflow-y-auto`

**Step 3: Commit fixes**

```bash
git add components/modals/
git commit -m "fix(responsive): improve modal responsiveness"
```

---

### Task 10: Final Testing & Documentation

**Step 1: Test all breakpoints**

Test at: 375px (phone), 768px (tablet), 1024px (desktop)

**Step 2: Run full build**

```bash
npm run build && npm run lint
```

**Step 3: Create final commit**

```bash
git add .
git commit -m "feat(responsive): complete mobile responsive implementation"
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-6 | Sidebar hamburger menu, overlay, layout margin |
| 2 | 7-10 | Feature components, modals, final testing |

**Key Files Changed:**
- `App.tsx` - State, layout margin, integrations
- `components/Header.tsx` - Sidebar responsive classes
- `components/MobileMenuButton.tsx` - New
- `components/MobileOverlay.tsx` - New
- Various feature/modal components - Responsive improvements
