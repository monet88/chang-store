# Brainstorm Report: Google Drive Gallery Sync

**Date:** 2026-01-02
**Status:** Approved for Implementation

---

## Problem Statement

User wants to persist gallery images beyond session and sync across devices. Current implementation stores images in-memory only (ImageGalleryContext), lost on refresh/close.

## Requirements

| Requirement | Decision |
|-------------|----------|
| Cloud Provider | Google Drive (user's own storage) |
| Authentication | Full OAuth 2.0 flow |
| Sync Mode | Auto-sync on save |
| Offline Support | No (online-only) |
| Multi-device | Yes, last-write-wins |
| Effort Budget | 3-5 days |

---

## Evaluated Approaches

### Approach 1: Direct Client-Side Google Drive API ✅ CHOSEN
**Architecture:** Browser → OAuth → Google Drive API v3

| Pros | Cons |
|------|------|
| No backend needed | OAuth complexity in SPA |
| User owns data (privacy) | Token refresh handling |
| Free (user's Drive quota) | Google Cloud Console setup |
| Standard, well-documented | CORS considerations |

### Approach 2: Firebase Storage ❌ REJECTED
**Reason:** Data stored on Firebase, not user's Drive. User cannot browse files. Cost at scale.

### Approach 3: Export on Demand ❌ REJECTED
**Reason:** Doesn't meet auto-sync requirement. Manual action required.

---

## Recommended Solution

### Architecture
```
┌─────────────────────────────────────────────────────┐
│                    Chang-Store SPA                  │
├─────────────────────────────────────────────────────┤
│  ImageGalleryContext (enhanced)                     │
│    ├── images: ImageFile[]                          │
│    ├── syncStatus: 'synced'|'pending'|'error'       │
│    └── lastSynced: Date                             │
├─────────────────────────────────────────────────────┤
│  GoogleDriveContext                                 │
│    ├── isConnected: boolean                         │
│    ├── user: GoogleUser | null                      │
│    ├── signIn() / signOut()                         │
│    └── accessToken (managed internally)             │
├─────────────────────────────────────────────────────┤
│  services/googleDriveService.ts                     │
│    ├── uploadImage(image, metadata)                 │
│    ├── downloadAllImages()                          │
│    ├── deleteImage(fileId)                          │
│    └── getOrCreateAppFolder()                       │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              Google Drive API v3                    │
│  Folder: /Chang-Store-Gallery/                      │
│    ├── image-{uuid}.json                            │
│    │   { base64, mimeType, createdAt, feature }     │
│    └── ...                                          │
└─────────────────────────────────────────────────────┘
```

### File Structure
```
contexts/
  └── GoogleDriveContext.tsx    # OAuth state, token management
services/
  └── googleDriveService.ts     # API calls: CRUD operations
hooks/
  └── useGoogleDriveSync.ts     # Sync logic, queue, retry
components/
  └── GoogleDriveSettings.tsx   # Connect/disconnect UI
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Store as JSON files | Preserves metadata, easy to parse |
| Dedicated app folder | Isolation from user's other files |
| Last-write-wins | Simpler than conflict resolution |
| Token in memory only | Security, re-auth on new session OK |

---

## Implementation Phases

### Phase 1: Setup & Auth (Day 1)
- Create Google Cloud project
- Configure OAuth 2.0 credentials
- Implement GoogleDriveContext with sign-in/out
- Add environment variables for client ID

### Phase 2: Core Sync (Day 2-3)
- Implement googleDriveService (upload, download, list)
- Create app folder on first sync
- Integrate with ImageGalleryContext
- Auto-upload on addImage()

### Phase 3: UI & UX (Day 4)
- GoogleDriveSettings component in SettingsModal
- Sync status indicator (icon in header)
- Last synced timestamp
- Error states and retry button

### Phase 4: Polish (Day 5)
- Token refresh handling
- Rate limiting / debounce uploads
- Progress indicator for initial load
- Error boundaries

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OAuth popup blocked | Medium | High | Fallback to redirect flow |
| Large gallery slow | Medium | Medium | Lazy load, pagination |
| API quota exceeded | Low | High | Batch requests, rate limit |
| Token expired | High | Low | Silent refresh, graceful re-auth |

---

## Success Metrics

- [ ] User can connect Google Drive from Settings
- [ ] Images auto-sync within 5 seconds of save
- [ ] Gallery loads from Drive on new device/session
- [ ] Sync status visible in UI (synced/pending/error)
- [ ] Graceful handling of disconnected state

---

## Next Steps

1. Create implementation plan with detailed tasks
2. Set up Google Cloud project and credentials
3. Implement phase by phase with testing
