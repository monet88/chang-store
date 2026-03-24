# INTEGRATIONS

## External AI Providers

### Google Gemini and Imagen

- `services/apiClient.ts` creates the `GoogleGenAI` singleton.
- `services/gemini/image.ts` handles image edit/generate/upscale/extract flows.
- `services/gemini/text.ts` handles description, analysis, and prompt-generation flows.
- `services/gemini/video.ts` exists for Gemini video operations.
- Browser code receives the API key from settings or env through `contexts/ApiProviderContext.tsx` and `vite.config.ts`.

### Local Provider

- `services/localProviderService.ts` targets a Gemini-compatible `generateContent` endpoint.
- Base URL and API key come from `contexts/ApiProviderContext.tsx`.
- Default values can come from `VITE_LOCAL_PROVIDER_BASE_URL` and `VITE_LOCAL_PROVIDER_API_KEY`.
- `services/imageEditingService.ts` routes models with prefix `local--` to this provider.

### Anti Provider

- `services/antiProviderService.ts` mirrors the local provider contract.
- Base URL and API key are stored in `contexts/ApiProviderContext.tsx`.
- `services/imageEditingService.ts` routes models with prefix `anti--` to this provider.

## Google Drive

- OAuth state and token lifecycle live in `contexts/GoogleDriveContext.tsx`.
- Google Identity Services is loaded from `https://accounts.google.com/gsi/client` in `index.html`.
- Drive file operations live in `services/googleDriveService.ts`.
- Sync orchestration lives in `hooks/useGoogleDriveSync.ts`.
- Gallery integration lives in `contexts/ImageGalleryContext.tsx`.
- The app uses the Drive scope `https://www.googleapis.com/auth/drive.file`.

## Browser Storage

- API keys, provider URLs, and model selections are persisted in `localStorage` by `contexts/ApiProviderContext.tsx`.
- Google Drive session metadata is persisted in `localStorage` by `contexts/GoogleDriveContext.tsx`.
- Lookbook draft state is persisted in `localStorage` by `hooks/useLookbookGenerator.ts`.
- Debug logging toggle is persisted in `localStorage` by `services/debugService.ts`.

## Static and Remote Assets

- Pose library image URLs are embedded in `locales/en.ts`.
- Google Fonts are loaded in `index.html`.
- No application backend, database adapter, webhook handler, or server-side auth layer exists in this repo.

## Integration Boundaries

- All runtime integrations are called directly from browser code.
- There is no internal API route layer.
- Feature components and hooks pass provider config into `services/imageEditingService.ts` instead of calling providers directly.

## Key Files

- `services/imageEditingService.ts` - provider facade and routing.
- `services/localProviderService.ts` - local Gemini-compatible HTTP client.
- `services/antiProviderService.ts` - anti provider HTTP client.
- `services/googleDriveService.ts` - Drive REST file operations.
- `contexts/ApiProviderContext.tsx` - provider credentials and model selection.
- `contexts/GoogleDriveContext.tsx` - OAuth token client and session lifecycle.
