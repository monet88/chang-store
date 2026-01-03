---
title: "Google Drive Gallery Sync"
description: "Persist gallery images to Google Drive with auto-sync and cross-device support"
status: pending
priority: P1
effort: 4d
branch: feat/google-drive-sync
tags: [google-drive, oauth, sync, persistence]
created: 2026-01-02
---

# Google Drive Gallery Sync - Implementation Plan

## Overview

Implement Google Drive integration to persist gallery images beyond session and enable cross-device sync. Uses OAuth 2.0 with Google Identity Services (GIS) for SPA authentication.

**Key Decisions:**
- Direct client-side Drive API (no backend)
- Store images as JSON files in `/Chang-Store-Gallery/` folder
- Last-write-wins for multi-device conflicts
- Token in memory only (re-auth on new session is acceptable)

---

## Phase 1: OAuth & Google Drive Context (Day 1)

### Task 1.1: Add Google Identity Services Script

**File:** `index.html`

Add GIS script to HTML head:

```html
<!-- Before closing </head> tag -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### Task 1.2: Environment Configuration

**File:** `vite.config.ts` (update)

Expose Google OAuth client ID:

```typescript
define: {
  'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID || ''),
  // ... existing defines
}
```

**File:** `.env.example` (create/update)

```env
# Google Drive OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Task 1.3: Create GoogleDriveContext

**File:** `contexts/GoogleDriveContext.tsx` (new)

```typescript
/**
 * Google Drive Authentication Context
 *
 * Manages OAuth 2.0 state, token lifecycle, and user info.
 * Uses Google Identity Services (GIS) for SPA auth flow.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

/** User profile info from Google */
interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

/** Context state and actions */
interface GoogleDriveContextType {
  /** Whether user is connected to Google Drive */
  isConnected: boolean;
  /** User profile info (null if not connected) */
  user: GoogleUser | null;
  /** Current access token (null if not connected) */
  accessToken: string | null;
  /** Whether auth is in progress */
  isAuthenticating: boolean;
  /** Last auth error message */
  authError: string | null;
  /** Initiate Google sign-in flow */
  signIn: () => Promise<void>;
  /** Sign out and revoke access */
  signOut: () => Promise<void>;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

// Google OAuth scopes needed for Drive access
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

/** Google token response shape */
interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export const GoogleDriveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null);

  // Initialize GIS token client on mount
  useEffect(() => {
    if (!CLIENT_ID) {
      console.warn('[GoogleDrive] No client ID configured');
      return;
    }

    // Wait for GIS script to load
    const initClient = () => {
      if (typeof google === 'undefined' || !google.accounts?.oauth2) {
        setTimeout(initClient, 100);
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse,
      });
      setTokenClient(client);
    };

    initClient();
  }, []);

  /** Handle token response from GIS */
  const handleTokenResponse = useCallback(async (response: TokenResponse) => {
    if (response.access_token) {
      setAccessToken(response.access_token);
      setIsConnected(true);
      setAuthError(null);

      // Fetch user info
      try {
        const userInfo = await fetchUserInfo(response.access_token);
        setUser(userInfo);
      } catch (err) {
        console.error('[GoogleDrive] Failed to fetch user info:', err);
      }
    }
    setIsAuthenticating(false);
  }, []);

  /** Fetch user profile from Google */
  const fetchUserInfo = async (token: string): Promise<GoogleUser> => {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch user info');
    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  };

  /** Initiate sign-in flow */
  const signIn = useCallback(async () => {
    if (!tokenClient) {
      setAuthError('Google Sign-In not initialized');
      return;
    }
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed');
      setIsAuthenticating(false);
    }
  }, [tokenClient]);

  /** Sign out and revoke token */
  const signOut = useCallback(async () => {
    if (accessToken) {
      // Revoke the token
      google.accounts.oauth2.revoke(accessToken, () => {
        console.log('[GoogleDrive] Token revoked');
      });
    }
    setAccessToken(null);
    setUser(null);
    setIsConnected(false);
  }, [accessToken]);

  return (
    <GoogleDriveContext.Provider
      value={{
        isConnected,
        user,
        accessToken,
        isAuthenticating,
        authError,
        signIn,
        signOut,
      }}
    >
      {children}
    </GoogleDriveContext.Provider>
  );
};

export const useGoogleDrive = (): GoogleDriveContextType => {
  const context = useContext(GoogleDriveContext);
  if (context === undefined) {
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  }
  return context;
};
```

### Task 1.4: Add TypeScript Types for GIS

**File:** `types/google.d.ts` (new)

```typescript
/**
 * Google Identity Services (GIS) Type Declarations
 *
 * Type definitions for the google.accounts.oauth2 API.
 */

declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(config?: { prompt?: string }): void;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message: string }) => void;
  }

  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(accessToken: string, callback?: () => void): void;
}
```

### Task 1.5: Update Provider Stack

**File:** `App.tsx` (update)

Add GoogleDriveProvider to provider stack:

```typescript
// Add import
import { GoogleDriveProvider } from './contexts/GoogleDriveContext';

// Update provider stack (after ApiProvider, before ImageGalleryProvider)
const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ToastProvider>
        <ApiProvider>
          <GoogleDriveProvider>
            <ImageGalleryProvider>
              <ImageViewerProvider>
                <AppContent />
              </ImageViewerProvider>
            </ImageGalleryProvider>
          </GoogleDriveProvider>
        </ApiProvider>
      </ToastProvider>
    </LanguageProvider>
  );
};
```

### Verification - Phase 1

1. Run `npm run dev` - no console errors
2. Check GIS script loads in Network tab
3. GoogleDriveContext imports without error
4. TypeScript compiles without errors

---

## Phase 2: Google Drive Service (Day 2)

### Task 2.1: Create Google Drive Service

**File:** `services/googleDriveService.ts` (new)

```typescript
/**
 * Google Drive API Service
 *
 * Handles all Drive API v3 operations:
 * - Create/get app folder
 * - Upload, download, list, delete image files
 *
 * All images stored as JSON files with metadata in /Chang-Store-Gallery/
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER_NAME = 'Chang-Store-Gallery';

/** Image file stored in Drive */
export interface DriveImageFile {
  id: string;
  name: string;
  base64: string;
  mimeType: string;
  createdAt: number;
  feature?: string;
}

/** Drive file metadata */
interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
}

/**
 * Get or create the app folder in user's Drive root
 * @param accessToken - OAuth access token
 * @returns Folder ID
 */
export async function getOrCreateAppFolder(accessToken: string): Promise<string> {
  // Search for existing folder
  const searchUrl = `${DRIVE_API_BASE}/files?q=name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;

  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchResponse.ok) {
    throw new Error(`Failed to search for app folder: ${searchResponse.statusText}`);
  }

  const searchData = await searchResponse.json();

  // Return existing folder if found
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new folder
  const createResponse = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create app folder: ${createResponse.statusText}`);
  }

  const folder = await createResponse.json();
  return folder.id;
}

/**
 * Upload an image to Google Drive
 * @param accessToken - OAuth access token
 * @param folderId - Parent folder ID
 * @param image - Image data (base64 + mimeType)
 * @param feature - Optional feature name that created the image
 * @returns Created file ID
 */
export async function uploadImage(
  accessToken: string,
  folderId: string,
  image: { base64: string; mimeType: string },
  feature?: string
): Promise<string> {
  const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const fileName = `${imageId}.json`;

  const fileContent: Omit<DriveImageFile, 'id' | 'name'> = {
    base64: image.base64,
    mimeType: image.mimeType,
    createdAt: Date.now(),
    feature,
  };

  // Use multipart upload for metadata + content
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
  };

  const boundary = '-------314159265358979323846';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(fileContent)}\r\n` +
    `--${boundary}--`;

  const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload image: ${response.statusText}`);
  }

  const file = await response.json();
  return file.id;
}

/**
 * List all image files in the app folder
 * @param accessToken - OAuth access token
 * @param folderId - App folder ID
 * @returns Array of file metadata
 */
export async function listImageFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFileMetadata[]> {
  const url = `${DRIVE_API_BASE}/files?q='${folderId}' in parents and mimeType='application/json' and trashed=false&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to list files: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Download an image file content
 * @param accessToken - OAuth access token
 * @param fileId - Drive file ID
 * @returns Image data
 */
export async function downloadImage(
  accessToken: string,
  fileId: string
): Promise<DriveImageFile> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const content = await response.json();
  return {
    id: fileId,
    name: '', // Will be populated by caller if needed
    ...content,
  };
}

/**
 * Download all images from app folder
 * @param accessToken - OAuth access token
 * @param folderId - App folder ID
 * @returns Array of image data
 */
export async function downloadAllImages(
  accessToken: string,
  folderId: string
): Promise<DriveImageFile[]> {
  const files = await listImageFiles(accessToken, folderId);

  // Download files in parallel (with limit to avoid rate limiting)
  const BATCH_SIZE = 5;
  const images: DriveImageFile[] = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        try {
          const image = await downloadImage(accessToken, file.id);
          return { ...image, id: file.id, name: file.name };
        } catch (err) {
          console.error(`Failed to download ${file.name}:`, err);
          return null;
        }
      })
    );
    images.push(...batchResults.filter((img): img is DriveImageFile => img !== null));
  }

  return images;
}

/**
 * Delete an image file from Drive
 * @param accessToken - OAuth access token
 * @param fileId - Drive file ID
 */
export async function deleteImage(accessToken: string, fileId: string): Promise<void> {
  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete image: ${response.statusText}`);
  }
}

/**
 * Find file ID by image base64 hash (for deduplication)
 * Uses filename convention: img-{timestamp}-{hash}.json
 * @param accessToken - OAuth access token
 * @param folderId - App folder ID
 * @param base64 - Image base64 to find
 * @returns File ID if found, null otherwise
 */
export async function findImageByBase64(
  accessToken: string,
  folderId: string,
  base64: string
): Promise<string | null> {
  // Use simple hash of first 50 chars for quick lookup
  const hash = base64.substring(0, 50);
  const files = await listImageFiles(accessToken, folderId);

  for (const file of files) {
    try {
      const image = await downloadImage(accessToken, file.id);
      if (image.base64 === base64) {
        return file.id;
      }
    } catch {
      // Skip files that fail to download
    }
  }

  return null;
}
```

### Verification - Phase 2

1. TypeScript compiles without errors
2. Service exports all functions correctly
3. Run manual test with mock token (should fail gracefully)

---

## Phase 3: Sync Hook & Gallery Integration (Day 3)

### Task 3.1: Create Sync Hook

**File:** `hooks/useGoogleDriveSync.ts` (new)

```typescript
/**
 * Google Drive Sync Hook
 *
 * Manages synchronization between local gallery and Google Drive:
 * - Auto-upload on addImage
 * - Auto-delete on deleteImage
 * - Load from Drive on connect
 * - Queue and retry logic for failed operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import { ImageFile } from '../types';
import * as driveService from '../services/googleDriveService';

/** Sync status for UI display */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/** Pending operation in sync queue */
interface SyncOperation {
  type: 'upload' | 'delete';
  image: ImageFile;
  driveFileId?: string;
  retryCount: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export function useGoogleDriveSync() {
  const { isConnected, accessToken } = useGoogleDrive();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // Queue for pending operations
  const syncQueue = useRef<SyncOperation[]>([]);
  const isProcessingQueue = useRef(false);

  // Map local base64 to Drive file ID for delete operations
  const imageToFileId = useRef<Map<string, string>>(new Map());

  /**
   * Initialize folder on connect
   */
  useEffect(() => {
    if (!isConnected || !accessToken) {
      setFolderId(null);
      setIsInitialLoadComplete(false);
      return;
    }

    const initFolder = async () => {
      try {
        setSyncStatus('syncing');
        const id = await driveService.getOrCreateAppFolder(accessToken);
        setFolderId(id);
        setSyncError(null);
      } catch (err) {
        console.error('[Sync] Failed to init folder:', err);
        setSyncError(err instanceof Error ? err.message : 'Failed to initialize Drive folder');
        setSyncStatus('error');
      }
    };

    initFolder();
  }, [isConnected, accessToken]);

  /**
   * Load images from Drive after folder is initialized
   */
  const loadFromDrive = useCallback(async (): Promise<ImageFile[]> => {
    if (!accessToken || !folderId) return [];

    try {
      setSyncStatus('syncing');
      const driveImages = await driveService.downloadAllImages(accessToken, folderId);

      // Build mapping for delete operations
      imageToFileId.current.clear();
      const images: ImageFile[] = driveImages.map((img) => {
        imageToFileId.current.set(img.base64, img.id);
        return { base64: img.base64, mimeType: img.mimeType };
      });

      setLastSynced(new Date());
      setSyncStatus('synced');
      setIsInitialLoadComplete(true);
      setSyncError(null);

      return images;
    } catch (err) {
      console.error('[Sync] Failed to load from Drive:', err);
      setSyncError(err instanceof Error ? err.message : 'Failed to load from Drive');
      setSyncStatus('error');
      return [];
    }
  }, [accessToken, folderId]);

  /**
   * Process pending operations in queue
   */
  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || syncQueue.current.length === 0) return;
    if (!accessToken || !folderId) return;

    isProcessingQueue.current = true;
    setSyncStatus('syncing');

    while (syncQueue.current.length > 0) {
      const operation = syncQueue.current[0];

      try {
        if (operation.type === 'upload') {
          const fileId = await driveService.uploadImage(
            accessToken,
            folderId,
            operation.image
          );
          imageToFileId.current.set(operation.image.base64, fileId);
        } else if (operation.type === 'delete' && operation.driveFileId) {
          await driveService.deleteImage(accessToken, operation.driveFileId);
          imageToFileId.current.delete(operation.image.base64);
        }

        // Success - remove from queue
        syncQueue.current.shift();
        setLastSynced(new Date());

      } catch (err) {
        console.error(`[Sync] Operation failed:`, err);

        if (operation.retryCount < MAX_RETRIES) {
          operation.retryCount++;
          // Move to end of queue for retry
          syncQueue.current.shift();
          syncQueue.current.push(operation);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          // Max retries exceeded - remove and log error
          syncQueue.current.shift();
          setSyncError(`Failed to ${operation.type} after ${MAX_RETRIES} retries`);
        }
      }
    }

    isProcessingQueue.current = false;
    setSyncStatus(syncQueue.current.length === 0 ? 'synced' : 'error');
  }, [accessToken, folderId]);

  /**
   * Queue an upload operation
   */
  const queueUpload = useCallback((image: ImageFile) => {
    if (!isConnected) return;

    syncQueue.current.push({
      type: 'upload',
      image,
      retryCount: 0,
    });

    processQueue();
  }, [isConnected, processQueue]);

  /**
   * Queue a delete operation
   */
  const queueDelete = useCallback((image: ImageFile) => {
    if (!isConnected) return;

    const driveFileId = imageToFileId.current.get(image.base64);
    if (!driveFileId) return; // Not synced to Drive yet

    syncQueue.current.push({
      type: 'delete',
      image,
      driveFileId,
      retryCount: 0,
    });

    processQueue();
  }, [isConnected, processQueue]);

  /**
   * Force sync - reload from Drive
   */
  const forceSync = useCallback(async () => {
    return loadFromDrive();
  }, [loadFromDrive]);

  return {
    syncStatus,
    lastSynced,
    syncError,
    isInitialLoadComplete,
    queueUpload,
    queueDelete,
    loadFromDrive,
    forceSync,
  };
}
```

### Task 3.2: Enhance ImageGalleryContext

**File:** `contexts/ImageGalleryContext.tsx` (update)

```typescript
/**
 * Image Gallery Context (Enhanced with Drive Sync)
 *
 * Manages in-memory image gallery with optional Google Drive sync.
 * When Drive is connected, images are automatically synced on add/delete.
 */

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { ImageFile } from '../types';
import { useGoogleDrive } from './GoogleDriveContext';
import { useGoogleDriveSync, SyncStatus } from '../hooks/useGoogleDriveSync';

interface ImageGalleryContextType {
  images: ImageFile[];
  addImage: (image: ImageFile) => void;
  deleteImage: (base64: string) => void;
  clearImages: () => void;
  // Drive sync state
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  syncError: string | null;
  isLoadingFromDrive: boolean;
}

const ImageGalleryContext = createContext<ImageGalleryContextType | undefined>(undefined);

const GALLERY_SIZE_LIMIT = 20;

export const ImageGalleryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isLoadingFromDrive, setIsLoadingFromDrive] = useState(false);

  const { isConnected } = useGoogleDrive();
  const {
    syncStatus,
    lastSynced,
    syncError,
    isInitialLoadComplete,
    queueUpload,
    queueDelete,
    loadFromDrive,
  } = useGoogleDriveSync();

  // Load images from Drive when connected
  useEffect(() => {
    if (isConnected && !isInitialLoadComplete) {
      setIsLoadingFromDrive(true);
      loadFromDrive().then((driveImages) => {
        if (driveImages.length > 0) {
          setImages(driveImages.slice(0, GALLERY_SIZE_LIMIT));
        }
        setIsLoadingFromDrive(false);
      });
    }
  }, [isConnected, isInitialLoadComplete, loadFromDrive]);

  const addImage = useCallback((image: ImageFile) => {
    setImages(prevImages => {
      // Check for duplicates
      if (prevImages.some(img => img.base64 === image.base64)) {
        return prevImages;
      }
      const newImages = [image, ...prevImages];
      return newImages.slice(0, GALLERY_SIZE_LIMIT);
    });

    // Sync to Drive if connected
    if (isConnected) {
      queueUpload(image);
    }
  }, [isConnected, queueUpload]);

  const deleteImage = useCallback((base64: string) => {
    const imageToDelete = images.find(img => img.base64 === base64);

    setImages(prevImages => prevImages.filter(img => img.base64 !== base64));

    // Sync delete to Drive if connected
    if (isConnected && imageToDelete) {
      queueDelete(imageToDelete);
    }
  }, [images, isConnected, queueDelete]);

  const clearImages = useCallback(() => {
    // Queue delete for all images if connected
    if (isConnected) {
      images.forEach(img => queueDelete(img));
    }
    setImages([]);
  }, [images, isConnected, queueDelete]);

  return (
    <ImageGalleryContext.Provider value={{
      images,
      addImage,
      deleteImage,
      clearImages,
      syncStatus,
      lastSynced,
      syncError,
      isLoadingFromDrive,
    }}>
      {children}
    </ImageGalleryContext.Provider>
  );
};

export const useImageGallery = (): ImageGalleryContextType => {
  const context = useContext(ImageGalleryContext);
  if (context === undefined) {
    throw new Error('useImageGallery must be used within an ImageGalleryProvider');
  }
  return context;
};
```

### Verification - Phase 3

1. TypeScript compiles without errors
2. App loads without crash
3. Gallery still works in disconnected mode (no regression)
4. Console shows sync messages when Drive connected

---

## Phase 4: Settings UI (Day 4)

### Task 4.1: Create GoogleDriveSettings Component

**File:** `components/GoogleDriveSettings.tsx` (new)

```typescript
/**
 * Google Drive Settings Section
 *
 * UI for connecting/disconnecting Google Drive.
 * Shows connection status, user info, and sync state.
 */

import React from 'react';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import Spinner from './Spinner';
import { CheckCircleIcon, CloudIcon, RefreshIcon, WarningIcon, UserIcon } from './Icons';

export const GoogleDriveSettings: React.FC = () => {
  const {
    isConnected,
    user,
    isAuthenticating,
    authError,
    signIn,
    signOut,
  } = useGoogleDrive();

  const { syncStatus, lastSynced, syncError } = useImageGallery();

  const formatLastSynced = (date: Date | null): string => {
    if (!date) return 'Never';
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    return date.toLocaleTimeString();
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <Spinner className="w-4 h-4" />;
      case 'synced':
        return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
      case 'error':
        return <WarningIcon className="w-4 h-4 text-red-400" />;
      default:
        return <CloudIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <CloudIcon className="w-5 h-5 text-blue-400" />
        <h4 className="font-semibold text-slate-200">Google Drive Sync</h4>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Sync your gallery to Google Drive. Images are stored in your own Drive account.
      </p>

      {isConnected && user ? (
        <div className="space-y-3">
          {/* User info */}
          <div className="flex items-center gap-3 p-2 bg-slate-700/50 rounded-md">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <UserIcon className="w-8 h-8 text-slate-400" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Sync status */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {getSyncStatusIcon()}
              <span className="text-slate-300 capitalize">{syncStatus}</span>
            </div>
            <span className="text-xs text-slate-500">
              Last synced: {formatLastSynced(lastSynced)}
            </span>
          </div>

          {/* Sync error */}
          {syncError && (
            <div className="p-2 bg-red-900/30 border border-red-800/50 rounded text-xs text-red-300">
              {syncError}
            </div>
          )}

          {/* Disconnect button */}
          <button
            onClick={signOut}
            className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 font-medium py-2 rounded-md text-sm transition-colors border border-red-800/50"
          >
            Disconnect Google Drive
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Auth error */}
          {authError && (
            <div className="p-2 bg-red-900/30 border border-red-800/50 rounded text-xs text-red-300">
              {authError}
            </div>
          )}

          {/* Connect button */}
          <button
            onClick={signIn}
            disabled={isAuthenticating}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-medium py-2.5 rounded-md text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isAuthenticating ? (
              <>
                <Spinner className="w-4 h-4" />
                Connecting...
              </>
            ) : (
              <>
                <CloudIcon className="w-4 h-4" />
                Connect Google Drive
              </>
            )}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Your images stay private in your own Drive account
          </p>
        </div>
      )}
    </div>
  );
};
```

### Task 4.2: Add Missing Icons

**File:** `components/Icons.tsx` (update - add these icons)

```typescript
// Add to Icons.tsx

export const CloudIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
```

### Task 4.3: Integrate into SettingsModal

**File:** `components/modals/SettingsModal.tsx` (update)

Add import and section:

```typescript
// Add import at top
import { GoogleDriveSettings } from '../GoogleDriveSettings';

// Add section after API Keys section, before Application Data
<section>
  <h3 className="text-base md:text-lg font-semibold text-amber-400 mb-4">Cloud Sync</h3>
  <GoogleDriveSettings />
</section>
```

### Task 4.4: Add i18n Strings

**File:** `locales/en.ts` (update - add to export)

```typescript
googleDrive: {
  title: 'Google Drive Sync',
  description: 'Sync your gallery to Google Drive. Images are stored in your own Drive account.',
  connect: 'Connect Google Drive',
  connecting: 'Connecting...',
  disconnect: 'Disconnect Google Drive',
  privacyNote: 'Your images stay private in your own Drive account',
  lastSynced: 'Last synced',
  never: 'Never',
  justNow: 'Just now',
  minutesAgo: '{{count}} minutes ago',
  status: {
    idle: 'Idle',
    syncing: 'Syncing',
    synced: 'Synced',
    error: 'Error',
  },
},
```

**File:** `locales/vi.ts` (update - add matching keys)

```typescript
googleDrive: {
  title: 'Đồng bộ Google Drive',
  description: 'Đồng bộ thư viện ảnh với Google Drive. Ảnh được lưu trong tài khoản Drive của bạn.',
  connect: 'Kết nối Google Drive',
  connecting: 'Đang kết nối...',
  disconnect: 'Ngắt kết nối Google Drive',
  privacyNote: 'Ảnh của bạn được bảo mật trong tài khoản Drive của bạn',
  lastSynced: 'Đồng bộ lần cuối',
  never: 'Chưa bao giờ',
  justNow: 'Vừa xong',
  minutesAgo: '{{count}} phút trước',
  status: {
    idle: 'Chờ',
    syncing: 'Đang đồng bộ',
    synced: 'Đã đồng bộ',
    error: 'Lỗi',
  },
},
```

### Task 4.5: Add Sync Status Indicator to Gallery

**File:** `components/modals/GalleryModal.tsx` (update)

Add sync indicator in header:

```typescript
// Add import
import { useImageGallery } from '../../contexts/ImageGalleryContext';
import Spinner from '../Spinner';
import { CheckCircleIcon, CloudIcon, WarningIcon } from '../Icons';

// In GalleryModal component, update the useImageGallery destructure:
const { images, deleteImage, clearImages, syncStatus, isLoadingFromDrive } = useImageGallery();

// Add sync indicator next to title:
<div className="flex items-center gap-4">
  <h2 className="text-xl md:text-2xl font-bold">{t('gallery.title')} ({images.length})</h2>

  {/* Sync status indicator */}
  {syncStatus !== 'idle' && (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/50 text-xs">
      {syncStatus === 'syncing' && <Spinner className="w-3 h-3" />}
      {syncStatus === 'synced' && <CheckCircleIcon className="w-3 h-3 text-green-400" />}
      {syncStatus === 'error' && <WarningIcon className="w-3 h-3 text-red-400" />}
      <span className="text-slate-400 capitalize">{syncStatus}</span>
    </div>
  )}

  {/* ... existing clear button ... */}
</div>

// Show loading state for initial Drive load:
{isLoadingFromDrive ? (
  <div className="flex flex-col items-center justify-center h-full gap-4">
    <Spinner className="w-8 h-8" />
    <p className="text-slate-400">Loading from Google Drive...</p>
  </div>
) : images.length === 0 ? (
  // ... existing empty state ...
) : (
  // ... existing grid ...
)}
```

### Verification - Phase 4

1. Settings modal shows Google Drive section
2. Connect button triggers OAuth popup
3. User info displays after connection
4. Sync status shows in gallery modal
5. Disconnect works and clears state

---

## Phase 5: Polish & Error Handling (Day 5)

### Task 5.1: Token Refresh Handling

**File:** `contexts/GoogleDriveContext.tsx` (update)

Add token expiry tracking and refresh:

```typescript
// Add to state
const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(0);

// Update handleTokenResponse
const handleTokenResponse = useCallback(async (response: TokenResponse) => {
  if (response.access_token) {
    setAccessToken(response.access_token);
    setTokenExpiresAt(Date.now() + (response.expires_in * 1000));
    // ... rest of handler
  }
}, []);

// Add refresh check hook
useEffect(() => {
  if (!tokenExpiresAt || !tokenClient) return;

  // Refresh 5 minutes before expiry
  const refreshTime = tokenExpiresAt - (5 * 60 * 1000) - Date.now();
  if (refreshTime <= 0) return;

  const timer = setTimeout(() => {
    console.log('[GoogleDrive] Refreshing token');
    tokenClient.requestAccessToken({ prompt: '' }); // Silent refresh
  }, refreshTime);

  return () => clearTimeout(timer);
}, [tokenExpiresAt, tokenClient]);
```

### Task 5.2: Debounce Uploads

**File:** `hooks/useGoogleDriveSync.ts` (update)

Add debounce for rapid uploads:

```typescript
// Add at top
import { useMemo } from 'react';

// Add debounce utility
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// Update queueUpload with debounce
const debouncedProcessQueue = useMemo(
  () => debounce(processQueue, 500),
  [processQueue]
);

const queueUpload = useCallback((image: ImageFile) => {
  if (!isConnected) return;

  syncQueue.current.push({
    type: 'upload',
    image,
    retryCount: 0,
  });

  debouncedProcessQueue();
}, [isConnected, debouncedProcessQueue]);
```

### Task 5.3: Add Loading Skeleton

**File:** `components/GalleryLoadingSkeleton.tsx` (new)

```typescript
/**
 * Loading skeleton for gallery items during Drive sync
 */

import React from 'react';

export const GalleryLoadingSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-7xl mx-auto">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="aspect-square bg-slate-800 rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
};
```

### Task 5.4: Write Unit Tests

**File:** `__tests__/services/googleDriveService.test.ts` (new)

```typescript
/**
 * Unit tests for Google Drive Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

describe('googleDriveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateAppFolder', () => {
    it('returns existing folder ID when found', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'folder123', name: 'Chang-Store-Gallery' }] }),
      });

      const { getOrCreateAppFolder } = await import('../../services/googleDriveService');
      const folderId = await getOrCreateAppFolder('test-token');

      expect(folderId).toBe('folder123');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('creates new folder when not found', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'new-folder-id' }),
        });

      const { getOrCreateAppFolder } = await import('../../services/googleDriveService');
      const folderId = await getOrCreateAppFolder('test-token');

      expect(folderId).toBe('new-folder-id');
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

**File:** `__tests__/contexts/GoogleDriveContext.test.tsx` (new)

```typescript
/**
 * Unit tests for Google Drive Context
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoogleDriveProvider, useGoogleDrive } from '../../contexts/GoogleDriveContext';

// Mock GIS
(global as any).google = {
  accounts: {
    oauth2: {
      initTokenClient: vi.fn(() => ({ requestAccessToken: vi.fn() })),
      revoke: vi.fn(),
    },
  },
};

const TestComponent = () => {
  const { isConnected, signIn } = useGoogleDrive();
  return (
    <div>
      <span data-testid="connected">{isConnected ? 'yes' : 'no'}</span>
      <button onClick={signIn}>Sign In</button>
    </div>
  );
};

describe('GoogleDriveContext', () => {
  it('provides initial disconnected state', () => {
    render(
      <GoogleDriveProvider>
        <TestComponent />
      </GoogleDriveProvider>
    );

    expect(screen.getByTestId('connected')).toHaveTextContent('no');
  });
});
```

### Verification - Phase 5

1. Token auto-refreshes before expiry
2. Rapid saves don't cause API flooding
3. Loading skeleton shows during initial load
4. All tests pass: `npm run test`

---

## Commit Messages

```
Phase 1:
feat(auth): add Google Drive OAuth context with GIS integration

Phase 2:
feat(drive): implement Google Drive API service for gallery sync

Phase 3:
feat(sync): add Drive sync hook and integrate with ImageGalleryContext

Phase 4:
feat(ui): add Google Drive settings UI and sync status indicator

Phase 5:
feat(polish): add token refresh, debouncing, and unit tests
```

---

## Google Cloud Console Setup

### Required Steps (Before Implementation)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Chang-Store"
3. Enable Google Drive API:
   - APIs & Services > Library > Search "Google Drive API" > Enable
4. Configure OAuth consent screen:
   - APIs & Services > OAuth consent screen
   - User Type: External
   - App name: "Chang-Store Gallery"
   - Scopes: `drive.file`
5. Create OAuth 2.0 credentials:
   - APIs & Services > Credentials > Create Credentials > OAuth client ID
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000`, production URL
   - Copy Client ID to `.env`

---

## Files Created/Modified Summary

| File | Action | Description |
|------|--------|-------------|
| `index.html` | Update | Add GIS script |
| `vite.config.ts` | Update | Expose GOOGLE_CLIENT_ID env |
| `.env.example` | Create | Document env vars |
| `types/google.d.ts` | Create | GIS type declarations |
| `contexts/GoogleDriveContext.tsx` | Create | OAuth state management |
| `services/googleDriveService.ts` | Create | Drive API operations |
| `hooks/useGoogleDriveSync.ts` | Create | Sync queue and logic |
| `contexts/ImageGalleryContext.tsx` | Update | Integrate sync |
| `components/GoogleDriveSettings.tsx` | Create | Connection UI |
| `components/Icons.tsx` | Update | Add Cloud/Warning icons |
| `components/modals/SettingsModal.tsx` | Update | Add Drive section |
| `components/modals/GalleryModal.tsx` | Update | Add sync indicator |
| `components/GalleryLoadingSkeleton.tsx` | Create | Loading state |
| `locales/en.ts` | Update | Add i18n strings |
| `locales/vi.ts` | Update | Add Vietnamese strings |
| `App.tsx` | Update | Add GoogleDriveProvider |
| `__tests__/services/googleDriveService.test.ts` | Create | Service tests |
| `__tests__/contexts/GoogleDriveContext.test.tsx` | Create | Context tests |

---

## Unresolved Questions

1. **Gallery size limit**: Current limit is 20 images. Should Drive sync increase this? (Storage is user's quota)
2. **Conflict resolution**: Plan uses last-write-wins. Need to confirm this is acceptable for multi-device use.
3. **Existing local images**: When connecting Drive for first time, should existing session images be uploaded? (Plan assumes yes)
