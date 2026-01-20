# Remove AIVideoAuto & Add Debug Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove AIVideoAuto provider completely, delete Video/GRWMVideo features, and add debug console logging for API calls.

**Architecture:**
- Delete all AIVideoAuto-related code (service, context state, settings UI)
- Remove Video and GRWMVideo features (components, hooks, tests, tabs)
- Create centralized `debugService.ts` with styled console groups
- Add debug toggle in Settings UI, store in localStorage

**Tech Stack:** React, TypeScript, localStorage, Console API (console.group, %c styling)

---

## Task 1: Delete AIVideoAuto Service

**Files:**
- Delete: `services/aivideoautoService.ts`
- Delete: `__tests__/services/aivideoautoService.test.ts`

**Step 1: Delete the service file**

```bash
rm services/aivideoautoService.ts
```

**Step 2: Delete the test file**

```bash
rm __tests__/services/aivideoautoService.test.ts
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete aivideoautoService and its tests"
```

---

## Task 2: Delete Video Feature Components

**Files:**
- Delete: `components/VideoGenerator.tsx`
- Delete: `components/GRWMVideoGenerator.tsx`
- Delete: `hooks/useVideoGenerator.ts`
- Delete: `hooks/useGRWMVideoGenerator.ts`
- Delete: `__tests__/hooks/useVideoGenerator.test.tsx`

**Step 1: Delete all video-related files**

```bash
rm components/VideoGenerator.tsx
rm components/GRWMVideoGenerator.tsx
rm hooks/useVideoGenerator.ts
rm hooks/useGRWMVideoGenerator.ts
rm __tests__/hooks/useVideoGenerator.test.tsx
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: delete Video and GRWMVideo feature files"
```

---

## Task 3: Remove Video Features from types.ts

**Files:**
- Modify: `types.ts`

**Step 1: Remove Video and GRWMVideo from Feature enum**

Remove these lines from `types.ts`:
```typescript
// REMOVE these lines:
Video = 'video',
GRWMVideo = 'grwm-video',
```

**Step 2: Remove AIVideoAutoModel interface**

Remove the entire `AIVideoAutoModel` interface (lines 75-97):
```typescript
// REMOVE this entire interface:
export interface AIVideoAutoModel {
  id_base: string;
  name: string;
  // ... all properties
}
```

**Step 3: Remove VideoGenerateModel type**

Remove this line:
```typescript
// REMOVE:
export type VideoGenerateModel = string;
```

**Step 4: Verify TypeScript compiles**

```bash
npm run lint
```
Expected: May show errors in files that reference removed types (we'll fix those next)

**Step 5: Commit**

```bash
git add types.ts
git commit -m "chore: remove Video/GRWMVideo from Feature enum and AIVideoAutoModel type"
```

---

## Task 4: Update App.tsx - Remove Video Imports and Routes

**Files:**
- Modify: `App.tsx`

**Step 1: Remove lazy imports for Video components**

Remove these lines (around lines 29-31):
```typescript
// REMOVE:
const VideoGenerator = lazy(() => import('./components/VideoGenerator').then(m => ({ default: m.VideoGenerator })));
const GRWMVideoGenerator = lazy(() => import('./components/GRWMVideoGenerator').then(m => ({ default: m.GRWMVideoGenerator })));
```

**Step 2: Remove Video cases from renderActiveFeature switch**

Remove these cases (around lines 113-116):
```typescript
// REMOVE:
case Feature.Video:
  return <VideoGenerator key="video" />;
case Feature.GRWMVideo:
  return <GRWMVideoGenerator key="grwm-video" />;
```

**Step 3: Verify no TypeScript errors**

```bash
npm run lint
```

**Step 4: Commit**

```bash
git add App.tsx
git commit -m "chore: remove Video/GRWMVideo from App.tsx"
```

---

## Task 5: Update Tabs.tsx - Remove Video Tabs

**Files:**
- Modify: `components/Tabs.tsx`

**Step 1: Remove Video tabs from TABS_CONFIG**

Remove these lines from TABS_CONFIG array:
```typescript
// REMOVE:
{ id: Feature.Video, label: t('tabs.videoAI') },
{ id: Feature.GRWMVideo, label: t('tabs.grwmVideo') },
```

**Step 2: Commit**

```bash
git add components/Tabs.tsx
git commit -m "chore: remove Video/GRWMVideo tabs"
```

---

## Task 6: Clean ApiProviderContext - Remove AIVideoAuto State

**Files:**
- Modify: `contexts/ApiProviderContext.tsx`

**Step 1: Remove AIVideoAuto imports**

Remove any imports related to AIVideoAuto types.

**Step 2: Remove from ApiContextType interface**

Remove these properties:
```typescript
// REMOVE from interface:
aivideoautoAccessToken: string | null;
aivideoautoImageModels: AIVideoAutoModel[];
aivideoautoVideoModels: AIVideoAutoModel[];
setAivideoautoAccessToken: (token: string | null) => void;
setAivideoautoImageModels: (models: AIVideoAutoModel[]) => void;
setAivideoautoVideoModels: (models: AIVideoAutoModel[]) => void;
videoGenerateModel: VideoGenerateModel;
setVideoGenerateModel: (model: VideoGenerateModel) => void;
```

**Step 3: Remove state declarations in ApiProvider**

Remove:
```typescript
// REMOVE state:
const [aivideoautoAccessToken, setAivideoautoAccessTokenState] = useState<string | null>(null);
const [aivideoautoImageModels, setAivideoautoImageModelsState] = useState<AIVideoAutoModel[]>([]);
const [aivideoautoVideoModels, setAivideoautoVideoModelsState] = useState<AIVideoAutoModel[]>([]);
const [videoGenerateModel, setVideoGenerateModelState] = useState<VideoGenerateModel>('');
```

**Step 4: Remove setter functions**

Remove all `setAivideoauto*` and `setVideoGenerateModel` functions.

**Step 5: Simplify getModelsForFeature**

Replace the function to remove video logic:
```typescript
const getModelsForFeature = (_feature: Feature) => {
  return {
    imageEditModel,
    imageGenerateModel,
    textGenerateModel,
  };
};
```

**Step 6: Update context value**

Remove all AIVideoAuto and video properties from the context value object.

**Step 7: Commit**

```bash
git add contexts/ApiProviderContext.tsx
git commit -m "refactor: remove AIVideoAuto state from ApiProviderContext"
```

---

## Task 7: Clean SettingsModal - Remove AIVideoAuto Settings

**Files:**
- Modify: `components/modals/SettingsModal.tsx`

**Step 1: Remove AIVideoAuto imports**

Remove `listModels` import from aivideoautoService.

**Step 2: Remove AIVideoAuto state and handlers**

Remove:
- `localAivideoautoKey` state
- `isTestingAivideoauto` state
- `aivideoautoError` state
- `aivideoautoSaveSuccess` state
- `handleAivideoautoKeyCheckAndSave` function

**Step 3: Remove from useApi destructuring**

Remove:
```typescript
// REMOVE:
aivideoautoAccessToken, setAivideoautoAccessToken,
aivideoautoImageModels, setAivideoautoImageModels,
aivideoautoVideoModels, setAivideoautoVideoModels,
videoGenerateModel, setVideoGenerateModel,
```

**Step 4: Update SERVICES arrays**

Update `IMAGE_EDIT_SERVICES` to remove aivideoauto:
```typescript
const IMAGE_EDIT_SERVICES = [
  { id: 'google', name: 'Google' },
  { id: 'local', name: 'Agy Provider' },
];
```

Remove `VIDEO_GENERATE_SERVICES` entirely.

**Step 5: Update MODELS_BY_SERVICE**

Remove `aivideoauto` entries from imageEdit and imageGenerate.
Remove `videoGenerate` key entirely.

**Step 6: Remove video model state**

Remove `localVideoGenerateModel` state and its sync in useEffect.

**Step 7: Remove AIVideoAuto UI section**

Remove the entire AIVideoAuto input field and test button section from JSX.

**Step 8: Remove Video Model Selector**

Remove the ServiceModelSelector for video generation.

**Step 9: Commit**

```bash
git add components/modals/SettingsModal.tsx
git commit -m "refactor: remove AIVideoAuto settings from SettingsModal"
```

---

## Task 8: Clean imageEditingService - Remove AIVideoAuto References

**Files:**
- Modify: `services/imageEditingService.ts`

**Step 1: Remove AIVideoAuto imports**

Remove any imports from aivideoautoService.

**Step 2: Remove AIVideoAuto routing logic**

In functions like `editImage`, `generateImage`, `generateVideo`:
- Remove any `if (model.startsWith('aivideoauto--'))` branches
- Remove the `generateVideo` function entirely (or keep empty with TODO)

**Step 3: Remove ApiConfig properties for AIVideoAuto**

Update `ApiConfig` interface:
```typescript
interface ApiConfig {
  localApiBaseUrl?: string | null;
  localApiKey?: string | null;
  onStatusUpdate?: (status: string) => void;
}
```

**Step 4: Commit**

```bash
git add services/imageEditingService.ts
git commit -m "refactor: remove AIVideoAuto from imageEditingService"
```

---

## Task 9: Clean Locale Files

**Files:**
- Modify: `locales/en.ts`
- Modify: `locales/vi.ts`

**Step 1: Remove video-related translations**

Remove from both files:
```typescript
// REMOVE from tabs:
videoAI: '...',
grwmVideo: '...',
```

Remove any other AIVideoAuto or video-related translation keys.

**Step 2: Commit**

```bash
git add locales/en.ts locales/vi.ts
git commit -m "chore: remove video-related translations"
```

---

## Task 10: Clean Remaining References

**Files:**
- Modify: Various files with remaining aivideoauto references

**Step 1: Search and fix remaining references**

```bash
# Find remaining references
grep -r "aivideoauto\|AIVideoAuto\|gommo\|Video\|video" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".git"
```

Fix each remaining reference case by case.

**Step 2: Run lint to verify**

```bash
npm run lint
```

**Step 3: Run tests**

```bash
npm run test
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean remaining AIVideoAuto and Video references"
```

---

## Task 11: Create Debug Service

**Files:**
- Create: `services/debugService.ts`

**Step 1: Create the debug service**

```typescript
const STORAGE_KEY = 'chang-store-debug';

export type Provider = 'Gemini' | 'Local';

export interface ApiCallLog {
  provider: Provider;
  model: string;
  feature: string;
  prompt?: string;
  duration: number;
  status: 'pending' | 'success' | 'error';
  responseSize?: number;
  error?: string;
}

const PROVIDER_STYLES: Record<Provider, string> = {
  Gemini: 'color: #4285f4; font-weight: bold',
  Local: 'color: #10b981; font-weight: bold',
};

export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setDebugEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function logApiCall(log: ApiCallLog): void {
  if (!isDebugEnabled()) return;

  const providerStyle = PROVIDER_STYLES[log.provider];
  const statusIcon = log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '⏳';
  const statusColor = log.status === 'success' ? 'color: #10b981' : log.status === 'error' ? 'color: #ef4444' : 'color: #f59e0b';

  console.group(`%c[ChangStore] ${log.feature}`, 'color: #fbbf24; font-weight: bold');
  console.log(`%cProvider: %c${log.provider}`, 'color: #94a3b8', providerStyle);
  console.log(`%cModel: %c${log.model}`, 'color: #94a3b8', 'color: #e2e8f0');
  if (log.prompt) {
    const truncatedPrompt = log.prompt.length > 100 ? log.prompt.slice(0, 100) + '...' : log.prompt;
    console.log(`%cPrompt: %c${truncatedPrompt}`, 'color: #94a3b8', 'color: #e2e8f0');
  }
  console.log(`%c⏱ Duration: %c${(log.duration / 1000).toFixed(2)}s`, 'color: #94a3b8', 'color: #e2e8f0');
  if (log.responseSize) {
    const sizeMB = (log.responseSize / 1024 / 1024).toFixed(2);
    console.log(`%c📦 Response: %c${sizeMB} MB`, 'color: #94a3b8', 'color: #e2e8f0');
  }
  console.log(`%c${statusIcon} ${log.status.charAt(0).toUpperCase() + log.status.slice(1)}`, statusColor);
  if (log.error) {
    console.log(`%cError: %c${log.error}`, 'color: #94a3b8', 'color: #ef4444');
  }
  console.groupEnd();
}
```

**Step 2: Commit**

```bash
git add services/debugService.ts
git commit -m "feat: add debugService for styled console logging"
```

---

## Task 12: Add Debug Toggle to Settings UI

**Files:**
- Modify: `components/modals/SettingsModal.tsx`

**Step 1: Import debug service**

```typescript
import { isDebugEnabled, setDebugEnabled } from '../../services/debugService';
```

**Step 2: Add debug state**

```typescript
const [debugMode, setDebugMode] = useState(() => isDebugEnabled());
```

**Step 3: Add toggle handler**

```typescript
const handleDebugToggle = () => {
  const newValue = !debugMode;
  setDebugMode(newValue);
  setDebugEnabled(newValue);
};
```

**Step 4: Add Debug toggle UI**

Add after the existing settings sections:
```tsx
{/* Debug Mode */}
<div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-sm font-medium text-slate-200">Debug Mode</h3>
      <p className="text-xs text-slate-400 mt-1">Log API calls to browser console (F12)</p>
    </div>
    <button
      onClick={handleDebugToggle}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        debugMode ? 'bg-amber-500' : 'bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
          debugMode ? 'translate-x-6' : ''
        }`}
      />
    </button>
  </div>
</div>
```

**Step 5: Commit**

```bash
git add components/modals/SettingsModal.tsx
git commit -m "feat: add Debug Mode toggle to Settings"
```

---

## Task 13: Integrate Debug Logging into Services

**Files:**
- Modify: `services/imageEditingService.ts`
- Modify: `services/geminiService.ts`
- Modify: `services/localProviderService.ts`
- Modify: `services/textService.ts`

**Step 1: Import debugService in each service**

```typescript
import { logApiCall, Provider } from './debugService';
```

**Step 2: Add logging wrapper pattern**

For each API function, wrap the call:
```typescript
export async function someApiCall(params: SomeParams): Promise<Result> {
  const startTime = Date.now();
  const provider: Provider = 'Gemini'; // or 'Local'

  try {
    const result = await actualApiCall(params);

    logApiCall({
      provider,
      model: params.model,
      feature: 'Feature Name',
      prompt: params.prompt,
      duration: Date.now() - startTime,
      status: 'success',
      responseSize: result.length, // if applicable
    });

    return result;
  } catch (error) {
    logApiCall({
      provider,
      model: params.model,
      feature: 'Feature Name',
      prompt: params.prompt,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
```

**Step 3: Commit**

```bash
git add services/
git commit -m "feat: integrate debug logging into all services"
```

---

## Task 14: Add Locale Strings for Debug Mode

**Files:**
- Modify: `locales/en.ts`
- Modify: `locales/vi.ts`

**Step 1: Add English translations**

```typescript
settings: {
  // ... existing
  debugMode: 'Debug Mode',
  debugModeDescription: 'Log API calls to browser console (F12)',
}
```

**Step 2: Add Vietnamese translations**

```typescript
settings: {
  // ... existing
  debugMode: 'Chế độ Debug',
  debugModeDescription: 'Ghi log API vào console trình duyệt (F12)',
}
```

**Step 3: Update SettingsModal to use translations**

Replace hardcoded strings with `t('settings.debugMode')` etc.

**Step 4: Commit**

```bash
git add locales/en.ts locales/vi.ts components/modals/SettingsModal.tsx
git commit -m "feat: add debug mode translations"
```

---

## Task 15: Run Full Test Suite and Build

**Step 1: Run linter**

```bash
npm run lint
```
Expected: No errors

**Step 2: Run tests**

```bash
npm run test
```
Expected: All tests pass (some may need updating for removed features)

**Step 3: Run build**

```bash
npm run build
```
Expected: Build succeeds

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup and verify build after AIVideoAuto removal"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1-2 | Delete AIVideoAuto service and Video components |
| 3-5 | Remove Video from types, App.tsx, Tabs |
| 6-7 | Clean ApiProviderContext and SettingsModal |
| 8-10 | Clean services and remaining references |
| 11-14 | Create and integrate debug service |
| 15 | Verify everything works |

**Total: 15 tasks**
