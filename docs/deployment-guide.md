# Deployment Guide

## Prerequisites
- Node.js v22+ (required for React 19 and Vite 6 compatibility)
- npm or yarn package manager
- Google Gemini API Key (`GEMINI_API_KEY`)
- Google OAuth Client ID (`GOOGLE_CLIENT_ID`) for Drive integration

## Environment Variables
Create a `.env.local` for development or add these to your CI/CD and deployment platform:
```env
VITE_GEMINI_API_KEY=your_gemini_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Build Process
1. **Install dependencies**: `npm install`
2. **Type Check**: `npx tsc --noEmit`
3. **Lint**: `npm run lint`
4. **Test**: `npm run test`
5. **Build**: `npm run build`

## Hosting
The application can be hosted on any static site hosting service (Vercel, Netlify, Cloudflare Pages, etc.).

### Vercel Deployment
1. Connect the GitHub repository to Vercel.
2. Set the framework preset to `Vite`.
3. Add the necessary environment variables in the Vercel dashboard.
4. Deploy. The `vercel.json` file in the root will handle single-page application routing rules if needed.

## Post-Deployment Validation
- Verify that API keys are correctly injected and Google Drive sync authorizes successfully.
- Check that the model registry successfully loads Gemini models.
