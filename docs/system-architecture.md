# Chang-Store: System Architecture

**Last Updated:** 2026-01-01

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENT                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         PRESENTATION LAYER                           │    │
│  │  ┌──────────┐  ┌──────────────────────────────────────────────────┐ │    │
│  │  │  Header  │  │              Feature Components                   │ │    │
│  │  │ (NavBar) │  │  VirtualTryOn | Lookbook | Background | Pose | ClothingTransfer ... │ │    │
│  │  └──────────┘  └──────────────────────────────────────────────────┘ │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐│    │
│  │  │              Modals: Gallery | Settings | PoseLibrary           ││    │
│  │  └─────────────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          HOOKS LAYER                                 │    │
│  │  useVirtualTryOn | useLookbook | useBackgroundReplacer | ...        │    │
│  │  (State Management + Business Logic)                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SERVICE LAYER                                │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │            imageEditingService (Unified Facade)               │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  │              │                                    │                  │    │
│  │              ▼                                    ▼                  │    │
│  │  ┌────────────────────┐              ┌────────────────────────┐     │    │
│  │  │   gemini/*         │              │  aivideoautoService    │     │    │
│  │  │  - image.ts        │              │  (gommo.net API)       │     │    │
│  │  │  - text.ts         │              └────────────────────────┘     │    │
│  │  │  - video.ts        │                                              │    │
│  │  └────────────────────┘                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │ HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL APIs                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Google Gemini  │  │  Google Imagen  │  │   Google Veo    │              │
│  │  (Text + Image) │  │  (Image Gen)    │  │  (Video Gen)    │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │  AIVideoAuto    │  │     ImgBB       │                                   │
│  │  (gommo.net)    │  │  (Image Host)   │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Provider Hierarchy

```
<LanguageProvider>           // i18n context (locale, t())
  <ApiProvider>              // API keys, model selection
    <ImageGalleryProvider>   // Session image storage
      <ImageViewerProvider>  // Fullscreen viewer state
        <AppContent />       // Main application
      </ImageViewerProvider>
    </ImageGalleryProvider>
  </ApiProvider>
</LanguageProvider>
```

**Provider Dependencies:**
- `ApiProvider` depends on `LanguageProvider` (error messages)
- `ImageGalleryProvider` is independent
- `ImageViewerProvider` is independent
- `AppContent` consumes all providers

## 3. Data Flow Diagrams

### 3.1 Image Generation Flow

```
┌──────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────────┐
│   User   │───▶│  Component  │───▶│      Hook        │───▶│   Service   │
│  Input   │    │  (UI Form)  │    │ (handleGenerate) │    │   Layer     │
└──────────┘    └─────────────┘    └──────────────────┘    └──────┬──────┘
                                                                   │
                     ┌─────────────────────────────────────────────┘
                     ▼
          ┌──────────────────────┐
          │ imageEditingService  │
          │   Route by Model     │
          └──────────┬───────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────┐        ┌────────────────┐
│ geminiService │        │ aivideoauto    │
│ (if gemini-*) │        │ (if aiva--)    │
└───────┬───────┘        └───────┬────────┘
        │                        │
        ▼                        ▼
┌───────────────────────────────────────┐
│         External API Response          │
│         (ImageFile[] or URL)           │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│   Hook State Update (setResults)       │
│   Gallery Context (addImage)           │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│      Component Re-render               │
│      Display Generated Images          │
└───────────────────────────────────────┘
```

### 3.2 Feature Selection Flow

```
Header (setActiveFeature)
         │
         ▼
   AppContent State
   (activeFeature)
         │
         ▼
   CSS Display Toggle
   (show/hide features)
         │
   ┌─────┴─────┬────────────┬────────────┐
   ▼           ▼            ▼            ▼
TryOn      Lookbook    Background     ...
(visible)  (hidden)    (hidden)     (hidden)
```

## 4. API Integration Patterns

### 4.1 Model Selection Strategy

```typescript
// ApiProviderContext.tsx
getModelsForFeature(feature: Feature) {
  // Video features force AIVideoAuto
  if ([Feature.Video, Feature.GRWMVideo].includes(feature)) {
    if (!videoModel.startsWith('aivideoauto--')) {
      return { videoGenerateModel: `aivideoauto--${fallbackModel.id_base}` };
    }
  }
  return { imageEditModel, imageGenerateModel, videoGenerateModel };
}
```

### 4.2 Service Routing

```typescript
// imageEditingService.ts
export const editImage = async (params, model, config) => {
  if (model.startsWith('aivideoauto--')) {
    const modelId = model.split('--')[1];
    return aivideoautoService.createImage(config.token, { model: modelId, ... });
  }
  return geminiImageService.editImage(params);
};
```

### 4.3 Status Updates

```typescript
// Hooks receive status callback for long-running operations
const buildServiceConfig = (onStatusUpdate: (msg: string) => void) => ({
  onStatusUpdate,
  aivideoautoAccessToken,
  aivideoautoImageModels,
});

// Usage in hook
await generateVideo(prompt, model, buildServiceConfig(setLoadingMessage));
```

## 5. Service Layer Design

### 5.1 Gemini Services

| Service | Functions | Model |
|---------|-----------|-------|
| `gemini/image.ts` | `editImage`, `generateImageFromText`, `upscaleImage`, `extractOutfitItem` | `imagen-4.0-generate-001`, `gemini-2.5-flash-image` |
| `gemini/text.ts` | `generateText` | `gemini-2.5-pro` |
| `gemini/video.ts` | `generateVideo` | `veo-3.1` |

### 5.2 AIVideoAuto Service

```typescript
// aivideoautoService.ts
export async function createImage(token, params): Promise<ImageFile>
export async function uploadImage(token, image): Promise<UploadedImage>
export async function createVideoTask(token, params): Promise<string>
export async function pollForVideo(token, taskId, onStatus): Promise<string>
```

### 5.3 API Client

```typescript
// apiClient.ts
let genAIClient: GoogleGenerativeAI | null = null;

export const setGeminiApiKey = (key: string | null) => {
  genAIClient = key ? new GoogleGenerativeAI(key) : null;
};

export const getGeminiClient = () => {
  if (!genAIClient) throw new Error('API key not configured');
  return genAIClient;
};
```

## 6. State Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    STATE OWNERSHIP                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GLOBAL (Context)                                            │
│  ├── Language: locale, t()                                   │
│  ├── API: keys, models, getModelsForFeature()               │
│  ├── Gallery: images[], addImage(), removeImage()           │
│  └── Viewer: viewerImage, isOpen                            │
│                                                              │
│  FEATURE (Hook)                                              │
│  ├── Inputs: subjectImage, clothingItems, prompt            │
│  ├── Outputs: generatedImages[], generatedVideo             │
│  ├── Loading: isLoading, loadingMessage                     │
│  └── Error: error                                            │
│                                                              │
│  COMPONENT (Local)                                           │
│  ├── Form state not in hook                                  │
│  └── UI toggles (dropdowns, tabs)                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 7. Error Handling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ERROR FLOW                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  API Error (Google/AIVideoAuto)                              │
│       │                                                      │
│       ▼                                                      │
│  Service Layer Catch                                         │
│       │                                                      │
│       ├── Known error key? (e.g., "error.api.rateLimit")    │
│       │         │                                            │
│       │         ▼                                            │
│       │   Throw with translation key                         │
│       │                                                      │
│       └── Unknown error?                                     │
│                 │                                            │
│                 ▼                                            │
│           Throw with raw message                             │
│                                                              │
│  Hook Layer Catch                                            │
│       │                                                      │
│       ▼                                                      │
│  getErrorMessage(err, t)                                     │
│       │                                                      │
│       ▼                                                      │
│  setError(localizedMessage)                                  │
│       │                                                      │
│       ▼                                                      │
│  Component displays error UI                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```
