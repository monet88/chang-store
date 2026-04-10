# Chang-Store: AI-Powered Virtual Fashion Studio

Chang-Store is a modern Single Page Application (SPA) built with React 19, TypeScript, and Vite. It serves as a virtual fashion studio powered by Google Gemini for advanced image editing and generative fashion features.

## ✨ Features

- **Virtual Try-on**: Seamlessly try out clothes on models using generative AI integration.
- **Lookbook Generation**: Automatically curate and generate fashion lookbooks.
- **Background Replacement**: Easily swap image backgrounds for varied aesthetics.
- **Pose Changing**: Control and change the poses of subjects in fashion shots.
- **Upscaling & Editing**: AI-powered upscaling and diverse image editing tools.

## 🚀 Tech Stack

- **Frontend**: React 19, Vite 6, TypeScript
- **Styling**: Tailwind CSS v4, PostCSS
- **State Management**: React Context & Hooks
- **AI Integration**: Google Gemini SDK (`@google/genai`)
- **Testing**: Vitest, React Testing Library
- **Tooling**: ESLint, TSX

## ⚙️ Environment Setup

To run the application locally, start by copying the example environment file:

```bash
cp .env.example .env.local
```

### Required Configuration

Make sure to populate the `.env.local` file with the following keys:

- `GEMINI_API_KEY`: Google Gemini API key used for the main AI generative features.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID required for Google Drive synchronization.

## 🏗 Architecture & Code Patterns

The project follows a Gemini-first service architecture:

```text
Component (Thin UI) → Hook (State + Logic) → Service Facade → Gemini API
```

### Provider Hierarchy

Dependencies are managed strictly by the tree order:
`LanguageProvider` → `ApiProvider` → `GoogleDriveProvider` → `ImageGalleryProvider` → `ImageViewerProvider` → `AppContent`

### Service Routing

Generative image features go through `src/services/imageEditingService.ts`, which delegates to the Gemini service layer in `src/services/gemini/*`.

## 🧑‍💻 Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Run automated tests
npm run test

# Build for production
npm run build
```

## 📐 Design Guidelines

The application adheres to a dark **glassmorphism** design theme. For further UI details, refer to `docs/design-guidelines.md`.

*Localization (i18n)* is managed via `src/locales/en.ts` functioning as the main source of truth. Always use `const { t } = useLanguage(); t('key.path')` inside components for text representation.
