/**
 * Google Drive Sync Engine Hook
 *
 * Core processing loop, retry logic, load-from-drive, and force sync.
 * Composes with useGoogleDriveSyncQueue for queue ownership.
 * Driver seam allows future direct unit tests with a mock driver.
 */

import { useCallback, useEffect } from 'react';
import { GalleryImageFile } from '../types';
import {
  getOrCreateAppFolder,
  uploadImage,
  listImageFiles,
  downloadAllImages,
  deleteImage as driveDeleteImage,
} from '../services/googleDriveService';
import {
  useGoogleDriveSyncQueue,
} from './useGoogleDriveSyncQueue';

export type { SyncStatus } from './useGoogleDriveSyncQueue';

export interface GoogleDriveSyncDriver {
  getOrCreateAppFolder: typeof getOrCreateAppFolder;
  uploadImage: typeof uploadImage;
  listImageFiles: typeof listImageFiles;
  downloadAllImages: typeof downloadAllImages;
  deleteImage: typeof driveDeleteImage;
}

export interface UseGoogleDriveSyncEngineConfig {
  driver: GoogleDriveSyncDriver;
  accessToken: string | null;
  folderId: string | null;
  setSyncStatus: React.Dispatch<React.SetStateAction<import('./useGoogleDriveSyncQueue').SyncStatus>>;
  setLastSynced: React.Dispatch<React.SetStateAction<Date | null>>;
  setSyncError: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UseGoogleDriveSyncEngineReturn {
  loadFromDrive: () => Promise<GalleryImageFile[]>;
  forceSync: () => Promise<void>;
  scheduleProcessQueue: (targetFolderId?: string) => void;
  queueUpload: (base64: string, mimeType: string, feature: string) => void;
  queueDelete: (base64: string) => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export const useGoogleDriveSyncEngine = (
  config: UseGoogleDriveSyncEngineConfig,
): UseGoogleDriveSyncEngineReturn => {
  const { driver, accessToken, folderId, setSyncStatus, setLastSynced, setSyncError } = config;

  const queue = useGoogleDriveSyncQueue();
  const {
    shiftNextOp,
    pushFailedOps,
    setMapping,
    getMapping,
    deleteMapping,
    registerProcessor,
    clearTimer,
    beginProcessing,
    endProcessing,
  } = queue;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const processQueue = useCallback(async (targetFolderId?: string) => {
    const currentFolderId = targetFolderId || folderId;

    if (!accessToken || !currentFolderId) return;
    if (!beginProcessing()) return;

    setSyncStatus('syncing');
    setSyncError(null);

    const failedOps: any[] = [];

    try {
      let op = shiftNextOp();
      while (op) {
        if (!folderId || folderId !== currentFolderId) {
          console.warn('[Sync] Folder changed mid-processing, aborting current cycle');
          if (op) pushFailedOps([op]);
          break;
        }

        try {
          if (op.type === 'upload') {
            const fileId = await driver.uploadImage(
              accessToken,
              currentFolderId,
              op.payload,
              op.mimeType || 'image/png',
              op.feature || 'unknown'
            );
            setMapping(op.payload, fileId);
          } else if (op.type === 'delete') {
            const fileId = getMapping(op.payload);
            if (fileId) {
              await driver.deleteImage(accessToken, fileId);
              deleteMapping(op.payload);
            }
          }
        } catch (err) {
          console.error(`[Sync] ${op.type} failed:`, err);

          if ((op.retries ?? 0) < MAX_RETRIES) {
            op.retries = (op.retries ?? 0) + 1;
            failedOps.push(op);
            await sleep(RETRY_DELAY_MS);
          } else {
            console.error(`[Sync] ${op.type} failed after ${MAX_RETRIES} retries`);
            setSyncError(`Failed to ${op.type} image after ${MAX_RETRIES} retries`);
          }
        }

        op = shiftNextOp();
      }

      if (failedOps.length > 0) {
        pushFailedOps(failedOps);
        setSyncStatus('error');
      } else {
        setSyncStatus('synced');
        setLastSynced(new Date());
      }
    } finally {
      endProcessing();
    }
  }, [driver, accessToken, folderId, setSyncStatus, setLastSynced, setSyncError, shiftNextOp, pushFailedOps, setMapping, getMapping, deleteMapping, beginProcessing, endProcessing]);

  useEffect(() => {
    registerProcessor(processQueue);
  }, [registerProcessor, processQueue]);

  const loadFromDrive = useCallback(async (): Promise<GalleryImageFile[]> => {
    if (!accessToken || !folderId) {
      return [];
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const files = await driver.listImageFiles(accessToken, folderId);

      const downloadedImages = await driver.downloadAllImages(
        accessToken,
        files.map(file => file.id)
      );

      const galleryImages: GalleryImageFile[] = downloadedImages.map((driveImage) => {
        setMapping(driveImage.base64, driveImage.id);

        return {
          base64: driveImage.base64,
          mimeType: driveImage.mimeType,
          driveFileId: driveImage.id,
          feature: driveImage.feature,
          createdAt: driveImage.createdAt,
        };
      });

      setSyncStatus('synced');
      setLastSynced(new Date());

      return galleryImages;
    } catch (err) {
      console.error('[Sync] Load from Drive failed:', err);
      setSyncStatus('error');
      setSyncError('Failed to load images from Drive');
      return [];
    }
  }, [driver, accessToken, folderId, setSyncStatus, setLastSynced, setSyncError, setMapping]);

  const forceSync = useCallback(async () => {
    clearTimer();
    await processQueue(folderId || undefined);
  }, [processQueue, folderId, clearTimer]);

  const { queueUpload, queueDelete, scheduleProcessQueue } = queue;

  return {
    loadFromDrive,
    forceSync,
    scheduleProcessQueue,
    queueUpload,
    queueDelete,
  };
};
