/**
 * Google Drive Sync Hook
 *
 * Manages synchronization between local gallery and Google Drive.
 * Provides queue-based upload/delete with retry logic.
 *
 * @see services/googleDriveService.ts for Drive API operations
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ImageFile } from '../types';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import {
  getOrCreateAppFolder,
  uploadImage,
  listImageFiles,
  downloadImage,
  deleteImage as driveDeleteImage,
} from '../services/googleDriveService';

// ============================================================================
// Types
// ============================================================================

/** Sync status states */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/** Queue operation types */
type QueueOperationType = 'upload' | 'delete';

/** Queue operation item */
interface QueueOperation {
  type: QueueOperationType;
  /** For upload: base64, For delete: fileId */
  payload: string;
  /** MIME type (for upload only) */
  mimeType?: string;
  /** Feature that generated image (for upload only) */
  feature?: string;
  /** Retry count */
  retries: number;
}

/** Extended ImageFile with Drive metadata */
export interface GalleryImageFile extends ImageFile {
  /** Google Drive file ID (undefined if not yet synced) */
  driveFileId?: string;
  /** Feature that generated this image */
  feature?: string;
  /** Creation timestamp */
  createdAt?: Date;
}

/** Hook return type */
export interface UseGoogleDriveSyncReturn {
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Last successful sync timestamp */
  lastSynced: Date | null;
  /** Current sync error message */
  syncError: string | null;
  /** App folder ID in Drive */
  folderId: string | null;
  /** Whether initial load from Drive is complete */
  isInitialLoadComplete: boolean;
  /** Load all images from Drive */
  loadFromDrive: () => Promise<GalleryImageFile[]>;
  /** Queue an image for upload to Drive */
  queueUpload: (base64: string, mimeType: string, feature: string) => void;
  /** Queue an image for deletion from Drive */
  queueDelete: (base64: string) => void;
  /** Force sync all pending operations */
  forceSync: () => Promise<void>;
  /** Clear sync error */
  clearError: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum retry attempts for failed operations */
const MAX_RETRIES = 3;

/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 2000;

/** Delay before processing queue (debounce) */
const QUEUE_PROCESS_DELAY_MS = 500;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGoogleDriveSync(): UseGoogleDriveSyncReturn {
  // --- Context ---
  const { isConnected, accessToken } = useGoogleDrive();

  // --- State ---
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // --- Refs ---
  /** Queue of pending operations */
  const syncQueueRef = useRef<QueueOperation[]>([]);

  /** Mapping from base64 to Drive file ID */
  const imageToFileIdRef = useRef<Map<string, string>>(new Map());

  /** Queue processing timer */
  const processTimerRef = useRef<NodeJS.Timeout | null>(null);

  /** Whether queue is currently being processed */
  const isProcessingRef = useRef(false);

  // --- Initialize folder on connect ---
  useEffect(() => {
    if (isConnected && accessToken && !folderId) {
      getOrCreateAppFolder(accessToken)
        .then(id => setFolderId(id))
        .catch(err => {
          console.error('[Sync] Failed to get/create folder:', err);
          setSyncError('Failed to access Drive folder');
        });
    }
  }, [isConnected, accessToken, folderId]);

  // --- Helper: Sleep for retry delay ---
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- Process Queue ---
  const processQueue = useCallback(async () => {
    // Guard: not connected or no token
    if (!accessToken || !folderId) return;

    // Guard: already processing (atomic check-and-set)
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // Guard: empty queue
    if (syncQueueRef.current.length === 0) {
      isProcessingRef.current = false;
      setSyncStatus('synced');
      return;
    }

    setSyncStatus('syncing');
    setSyncError(null);

    const failedOps: QueueOperation[] = [];

    try {
      while (syncQueueRef.current.length > 0) {
        const op = syncQueueRef.current.shift()!;

        try {
          if (op.type === 'upload') {
            // Upload new image (queueUpload already checks in-memory map)
            const fileId = await uploadImage(
              accessToken,
              folderId,
              op.payload,
              op.mimeType || 'image/png',
              op.feature || 'unknown'
            );
            imageToFileIdRef.current.set(op.payload, fileId);
          } else if (op.type === 'delete') {
            // op.payload is base64, need to find fileId
            const fileId = imageToFileIdRef.current.get(op.payload);
            if (fileId) {
              await driveDeleteImage(accessToken, fileId);
              imageToFileIdRef.current.delete(op.payload);
            }
            // If no fileId, image wasn't synced yet - nothing to delete
          }
        } catch (err) {
          console.error(`[Sync] ${op.type} failed:`, err);

          if (op.retries < MAX_RETRIES) {
            // Retry with delay
            op.retries++;
            failedOps.push(op);
            await sleep(RETRY_DELAY_MS);
          } else {
            // Max retries reached, log and skip
            console.error(`[Sync] ${op.type} failed after ${MAX_RETRIES} retries`);
            setSyncError(`Failed to ${op.type} image after ${MAX_RETRIES} retries`);
          }
        }
      }

      // Re-add failed ops for next cycle
      if (failedOps.length > 0) {
        syncQueueRef.current.push(...failedOps);
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
        setLastSynced(new Date());
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [accessToken, folderId]);

  // --- Schedule queue processing with debounce ---
  const scheduleProcessQueue = useCallback(() => {
    if (processTimerRef.current) {
      clearTimeout(processTimerRef.current);
    }
    processTimerRef.current = setTimeout(() => {
      processQueue();
    }, QUEUE_PROCESS_DELAY_MS);
  }, [processQueue]);

  // --- Load from Drive ---
  const loadFromDrive = useCallback(async (): Promise<GalleryImageFile[]> => {
    if (!accessToken || !folderId) {
      return [];
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      // List all files
      const files = await listImageFiles(accessToken, folderId);

      // Download each file and build gallery images
      const galleryImages: GalleryImageFile[] = [];

      for (const file of files) {
        try {
          const driveImage = await downloadImage(accessToken, file.id);

          // Map base64 to fileId
          imageToFileIdRef.current.set(driveImage.base64, driveImage.id);

          galleryImages.push({
            base64: driveImage.base64,
            mimeType: driveImage.mimeType,
            driveFileId: driveImage.id,
            feature: driveImage.feature,
            createdAt: driveImage.createdAt,
          });
        } catch (err) {
          console.error(`[Sync] Failed to download ${file.id}:`, err);
          // Continue with other files
        }
      }

      setIsInitialLoadComplete(true);
      setSyncStatus('synced');
      setLastSynced(new Date());

      return galleryImages;
    } catch (err) {
      console.error('[Sync] Load from Drive failed:', err);
      setSyncStatus('error');
      setSyncError('Failed to load images from Drive');
      return [];
    }
  }, [accessToken, folderId]);

  // --- Queue Upload ---
  const queueUpload = useCallback((base64: string, mimeType: string, feature: string) => {
    // Don't queue if already mapped (already on Drive)
    if (imageToFileIdRef.current.has(base64)) {
      return;
    }

    // Don't queue duplicate operations
    const exists = syncQueueRef.current.some(
      op => op.type === 'upload' && op.payload === base64
    );
    if (exists) return;

    syncQueueRef.current.push({
      type: 'upload',
      payload: base64,
      mimeType,
      feature,
      retries: 0,
    });

    scheduleProcessQueue();
  }, [scheduleProcessQueue]);

  // --- Queue Delete ---
  const queueDelete = useCallback((base64: string) => {
    // Remove any pending upload for this image
    syncQueueRef.current = syncQueueRef.current.filter(
      op => !(op.type === 'upload' && op.payload === base64)
    );

    // Only queue delete if image is on Drive
    if (imageToFileIdRef.current.has(base64)) {
      syncQueueRef.current.push({
        type: 'delete',
        payload: base64,
        retries: 0,
      });

      scheduleProcessQueue();
    }
  }, [scheduleProcessQueue]);

  // --- Force Sync ---
  const forceSync = useCallback(async () => {
    // Clear any pending timer
    if (processTimerRef.current) {
      clearTimeout(processTimerRef.current);
      processTimerRef.current = null;
    }

    // Process immediately
    await processQueue();
  }, [processQueue]);

  // --- Clear Error ---
  const clearError = useCallback(() => {
    setSyncError(null);
    if (syncStatus === 'error') {
      setSyncStatus('idle');
    }
  }, [syncStatus]);

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      if (processTimerRef.current) {
        clearTimeout(processTimerRef.current);
      }
    };
  }, []);

  return {
    syncStatus,
    lastSynced,
    syncError,
    folderId,
    isInitialLoadComplete,
    loadFromDrive,
    queueUpload,
    queueDelete,
    forceSync,
    clearError,
  };
}
