/**
 * Google Drive Sync Hook (orchestrator)
 *
 * Composes the sync engine and owns UI-visible state + lifecycle.
 * Public return surface and SyncStatus export are preserved exactly
 * so ImageGalleryContext and other consumers require zero changes.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { GalleryImageFile } from '../types';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import {
  getOrCreateAppFolder,
  uploadImage,
  listImageFiles,
  downloadAllImages,
  deleteImage as driveDeleteImage,
} from '../services/googleDriveService';
import {
  useGoogleDriveSyncEngine,
  type GoogleDriveSyncDriver,
  type SyncStatus,
} from './useGoogleDriveSyncEngine';

// Re-export SyncStatus for consumers that import the type from this file
export type { SyncStatus };

/** Hook return type (exact surface preserved) */
export interface UseGoogleDriveSyncReturn {
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  syncError: string | null;
  folderId: string | null;
  isInitialLoadComplete: boolean;
  loadFromDrive: () => Promise<GalleryImageFile[]>;
  queueUpload: (base64: string, mimeType: string, feature: string) => void;
  queueDelete: (base64: string) => void;
  forceSync: () => Promise<void>;
  clearError: () => void;
}

export function useGoogleDriveSync(): UseGoogleDriveSyncReturn {
  const { isConnected, accessToken } = useGoogleDrive();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // Default driver wraps real service; future tests can inject mock.
  const driver = useMemo<GoogleDriveSyncDriver>(() => ({
    getOrCreateAppFolder,
    uploadImage,
    listImageFiles,
    downloadAllImages,
    deleteImage: driveDeleteImage,
  }), []);

  const engine = useGoogleDriveSyncEngine({
    driver,
    accessToken,
    folderId,
    setSyncStatus,
    setLastSynced,
    setSyncError,
    setIsInitialLoadComplete,
  });

  // Initialize folder on connect (lifecycle owned by orchestrator)
  useEffect(() => {
    if (isConnected && accessToken && !folderId) {
      driver.getOrCreateAppFolder(accessToken)
        .then(id => setFolderId(id))
        .catch(err => {
          console.error('[Sync] Failed to get/create folder:', err);
          setSyncError('Failed to access Drive folder');
        });
    }
  }, [isConnected, accessToken, folderId, driver]);

  // Auto-process when folderId becomes available (engine guards empty queue)
  useEffect(() => {
    if (folderId) {
      engine.scheduleProcessQueue(folderId);
    }
  }, [folderId, engine]);


  const clearError = useCallback(() => {
    setSyncError(null);
    if (syncStatus === 'error') {
      setSyncStatus('idle');
    }
  }, [syncStatus]);

  return {
    syncStatus,
    lastSynced,
    syncError,
    folderId,
    isInitialLoadComplete,
    loadFromDrive: engine.loadFromDrive,
    queueUpload: engine.queueUpload,
    queueDelete: engine.queueDelete,
    forceSync: engine.forceSync,
    clearError,
  };
}
