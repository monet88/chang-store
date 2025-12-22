# Chang-Store: Project Overview and PDR

**Version:** 1.0.0
**Last Updated:** 2025-12-22

## 1. Vision Statement

Chang-Store is an AI-powered fashion and image editing web application that empowers users to visualize, create, and transform fashion content through generative AI. The platform bridges the gap between imagination and visualization for fashion enthusiasts, content creators, and e-commerce businesses.

## 2. Target Users

| User Type | Use Case |
|-----------|----------|
| Fashion Content Creators | Generate lookbooks, style videos, promotional content |
| E-commerce Businesses | Virtual try-on for products, background replacement |
| Individual Users | Personal styling, outfit analysis, photo enhancement |
| Social Media Influencers | GRWM videos, styled photo albums |

## 3. Core Value Proposition

- **AI-First Approach**: Every feature leverages generative AI (Google Gemini, Imagen, Veo)
- **Multi-Modal Creation**: Images, videos, and styled content from single inputs
- **No Technical Expertise Required**: Intuitive UI abstracts AI complexity
- **Bilingual Support**: English and Vietnamese localization

## 4. Feature List

### 4.1 Image Features (Priority: P0-P1)

| Feature | Priority | Description |
|---------|----------|-------------|
| Virtual Try-On | P0 | Overlay garments onto person photos |
| Background Replacer | P0 | AI background replacement with presets |
| Upscale | P0 | AI upscaling to 2K resolution |
| Lookbook Generator | P1 | 360-spin product lookbooks |
| Pose Changer | P1 | Change model poses from curated library |
| Swap Face | P1 | Face swap between two images |
| Outfit Analysis | P1 | AI critique + redesign (4 style presets) |
| Relight | P1 | Lighting condition changes |
| Inpainting | P1 | Region-based AI editing with masks |
| Image Editor | P2 | Full-featured brush/eraser/crop/filters |

### 4.2 Video Features (Priority: P1-P2)

| Feature | Priority | Description |
|---------|----------|-------------|
| Video Generator | P1 | Text/image-to-video (Veo 3.1 + AIVideoAuto) |
| GRWM Video | P2 | "Get Ready With Me" video sequences |
| Photo Album Creator | P2 | Styled albums from multiple images |
| Video Continuity | P3 | Multi-scene video sequences (placeholder) |

## 5. Technical Requirements

### 5.1 Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19.1.1 |
| Language | TypeScript 5.8 |
| Build Tool | Vite 6.2 |
| AI SDK | @google/genai ^1.17.0 |
| HTTP Client | axios ^1.7.2 |
| Testing | Vitest ^4.0.13 |
| Linting | ESLint ^9.15.0 |

### 5.2 External API Dependencies

| Service | Models | Purpose |
|---------|--------|---------|
| Google Gemini | gemini-2.5-pro, gemini-2.5-flash | Text generation, image analysis |
| Imagen | imagen-4.0-generate-001 | Image generation |
| Veo | veo-3.1 | Video generation |
| AIVideoAuto | Various via gommo.net | Alternative video/image models |
| ImgBB | - | Image hosting for sharing |

### 5.3 Constraints

- **Browser-Only**: No server-side rendering; all processing via external APIs
- **API Key Required**: Users must provide their own Google API key
- **Session Storage**: Images stored in-memory (session-based gallery)
- **Rate Limits**: Subject to Google AI API quotas

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target |
|--------|--------|
| Initial Load | < 3 seconds |
| Feature Switch | Instant (preloaded) |
| Image Generation | Dependent on API (typically 5-30s) |

### 6.2 Internationalization

- **Source Language**: English (`locales/en.ts`)
- **Translations**: Vietnamese (`locales/vi.ts`)
- **Pattern**: Context-based with `useLanguage()` hook

### 6.3 Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support (in progress)

### 6.4 Security

- API keys stored in localStorage (user-controlled)
- No server-side storage of sensitive data
- All API calls client-side (CORS-dependent)

## 7. Success Metrics

| Metric | Definition |
|--------|------------|
| Feature Adoption | % of sessions using each feature |
| Generation Success Rate | % of API calls returning valid results |
| User Retention | Return visits within 7 days |
| Error Rate | % of generations failing with user-facing errors |

## 8. Roadmap Considerations

1. **Video Continuity**: Complete multi-scene video implementation
2. **Offline Mode**: Service worker for cached UI
3. **Cloud Storage**: Optional integration for persistent galleries
4. **Additional Languages**: Expand beyond EN/VI
