# Project Overview & PDR (Product Development Requirements)

## Project Overview
Chang-Store is an AI-powered virtual fashion studio built as a React 19 + TypeScript + Vite Single Page Application (SPA). It uses a Gemini-only AI backend via the Google Gemini SDK. The application supports fashion image creation, editing, gallery review, and Google Drive-backed archive workflows.

## Core Features
1. **Virtual Try-on**: Try clothes on models using generative AI integration.
2. **Lookbook Generation**: Automatically curate and generate fashion lookbooks.
3. **Background Replacement**: Swap image backgrounds for varied aesthetics.
4. **Pose Changing**: Control and change the poses of subjects in fashion shots.
5. **Photo Album**: Generate complete photo albums with frames, backgrounds, and poses.
6. **AI Editor**: Prompt-driven AI image generation with refinement and editing.
7. **Pattern Generator**: Create fashion patterns from text descriptions.
8. **Clothing Transfer**: Transfer clothing between images with generative AI.
9. **Watermark Removal**: Remove watermarks from images with batch processing support.

## Target Audience
- Fashion designers and stylists
- E-commerce clothing retailers
- AI fashion enthusiasts and digital artists

## Product Goals
- Provide a Runway-inspired, premium, and fast user interface.
- Ensure state-of-the-art AI generation powered strictly by Google Gemini SDK.
- Offer secure, Google Drive-backed local archives and synchronization.

## Technology Stack
- **Frontend**: React 19.2.3, TypeScript 5.8.3, Vite 6.4.1
- **Styling**: Tailwind CSS 4.1.18, PostCSS
- **State Management**: React Context & Hooks
- **AI Backend**: `@google/genai` 1.38.0 (Google Gemini SDK)
- **Data Persistence**: IndexedDB (via `idb-keyval` 6.2.2), Google Drive API
- **Export**: ZIP downloads (via `jszip` 3.10.1)
- **Testing**: Vitest 4.0.17, React Testing Library
- **Tooling**: ESLint 9.39.2, TSX, SWC transpiler
