# Chang-Store: System Architecture

**Last Updated:** 2026-03-17

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
│  │  │ (NavBar) │  │  VirtualTryOn | Lookbook | Background | Pose | ...  │ │    │
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
│  │  (State Management + Business Logic + Drive Sync)                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SERVICE LAYER                                │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │            imageEditingService (Unified Facade)               │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  │              │                    │               │                  │    │
│  │              ▼                    ▼               ▼                  │    │
│  │  ┌────────────────────┐  ┌────────────────┐  ┌──────────────────┐    │    │
│  │  │   gemini/*         │  │ Local Provider │  │  Anti Provider   │    │    │
│  │  │  - image.ts        │  │ (REST)         │  │  (REST)          │    │    │
│  │  │  - text.ts         │  └────────────────┘  └──────────────────┘    │    │
│  │  │  - video.ts        │                                              │    │
│  │  └────────────────────┘                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        PERSISTENCE LAYER                             │    │
│  │  ┌────────────────────┐              ┌────────────────────────┐     │    │
│  │  │   LocalStorage     │              │      Google Drive      │     │    │
│  │  │  (Settings/Drafts) │              │      (Image Storage)   │     │    │
│  │  └────────────────────┘              └────────────────────────┘     │    │
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
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Local Provider │  │  Anti Provider  │  │  Google Drive   │              │
│  │  (Custom REST)  │  │  (Custom REST)  │  │  (OAuth/Files)  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Provider Hierarchy

```
<LanguageProvider>           // i18n context (locale, t())
  <ApiProvider>              // API keys, model selection, provider config
    <GoogleDriveProvider>    // OAuth state, Drive API integration
      <ImageGalleryProvider> // Gallery state with Drive sync + LRU cache
        <ImageViewerProvider>// Fullscreen viewer state
          <AppContent />     // Main application
        </ImageViewerProvider>
      </ImageGalleryProvider>
    </GoogleDriveProvider>
  </ApiProvider>
</LanguageProvider>
```

**Provider Dependencies:**
- `ApiProvider` depends on `LanguageProvider` (error messages)
- `GoogleDriveProvider` depends on `ApiProvider` (client IDs)
- `ImageGalleryProvider` depends on `GoogleDriveProvider` (syncing)
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
           │   Route by Prefix    │
           └──────────┬───────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────────┐ ┌───────────┐ ┌───────────┐
│ geminiService │ │ localProv │ │ antiProv  │
│ (default)     │ │ (local--) │ │ (anti--)  │
└───────┬───────┘ └─────┬─────┘ └─────┬─────┘
        │               │             │
        └───────────────┼─────────────┘
                        ▼
┌───────────────────────────────────────┐
│         External API Response          │
│         (ImageFile[] or URL)           │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│   Hook State Update (setResults)       │
│   Gallery Context (addImage)           │
│   Google Drive Sync (upload)           │
└───────────────────────────────────────┘
```

## 4. API Integration Patterns

### 4.1 Model Selection Strategy

```typescript
// ApiProviderContext.tsx
getModelsForFeature(feature: Feature) {
  // Prefix-based routing logic
  // local--model-name -> Local Provider
  // anti--model-name  -> Anti Provider
  // default           -> Gemini
  return { imageEditModel, imageGenerateModel, videoGenerateModel };
}
```

### 4.2 Service Routing

```typescript
// imageEditingService.ts
export const editImage = async (params, model, config) => {
  if (model.startsWith('local--')) {
    return localProvider.editImage(params, model.replace('local--', ''));
  }
  if (model.startsWith('anti--')) {
    return antiProvider.editImage(params, model.replace('anti--', ''));
  }
  return geminiImageService.editImage(params);
};
```

### 4.3 Persistence Strategy

- **LocalStorage**: Stores API keys, provider base URLs, and feature-specific drafts (debounced).
- **Google Drive**: Stores generated images in a dedicated folder. `ImageGalleryContext` manages a local LRU cache and syncs with Drive in the background.
- **OAuth**: Managed via `GoogleDriveContext` with automatic token refresh.
