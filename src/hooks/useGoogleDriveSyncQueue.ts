/** Sync status states (re-exported from here for consumer compatibility) */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/**
 * Google Drive Sync Queue Hook
 *
 * Owns the pending operation queue, base64->fileId mapping, debounce timer,
 * and enqueue/dequeue primitives. Extracted to keep the engine and orchestrator
 * under the 200 LOC limit and prepare queue logic for future testing.
 */

import { useCallback, useRef, useEffect } from 'react';

type QueueOperationType = 'upload' | 'delete';

/** Queue operation item */
export interface QueueOperation {
  type: QueueOperationType;
  payload: string;
  mimeType?: string;
  feature?: string;
  retries: number;
}

const QUEUE_PROCESS_DELAY_MS = 500;

export interface DriveSyncQueueHandle {
  shiftNextOp: () => QueueOperation | undefined;
  pushFailedOps: (ops: QueueOperation[]) => void;
  setMapping: (base64: string, fileId: string) => void;
  getMapping: (base64: string) => string | undefined;
  deleteMapping: (base64: string) => void;
  hasMapping: (base64: string) => boolean;
  hasPendingOps: () => boolean;
  beginProcessing: () => boolean;
  endProcessing: () => void;
}

export interface UseGoogleDriveSyncQueueReturn {
  queueUpload: (base64: string, mimeType: string, feature: string) => void;
  queueDelete: (base64: string) => void;
  scheduleProcessQueue: (targetFolderId?: string) => void;
  registerProcessor: (fn: (targetFolderId?: string) => void) => void;
  clearTimer: () => void;
}

export const useGoogleDriveSyncQueue = (): UseGoogleDriveSyncQueueReturn & DriveSyncQueueHandle => {
  const syncQueueRef = useRef<QueueOperation[]>([]);
  const imageToFileIdRef = useRef<Map<string, string>>(new Map());
  const processTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const processorRef = useRef<((target?: string) => void) | null>(null);

  const scheduleProcessQueue = useCallback((targetFolderId?: string) => {
    if (processTimerRef.current) {
      clearTimeout(processTimerRef.current);
    }
    processTimerRef.current = setTimeout(() => {
      processorRef.current?.(targetFolderId);
    }, QUEUE_PROCESS_DELAY_MS);
  }, []);

  const registerProcessor = useCallback((fn: (targetFolderId?: string) => void) => {
    processorRef.current = fn;
  }, []);

  const clearTimer = useCallback(() => {
    if (processTimerRef.current) {
      clearTimeout(processTimerRef.current);
      processTimerRef.current = null;
    }
  }, []);

  const queueUpload = useCallback((base64: string, mimeType: string, feature: string) => {
    if (imageToFileIdRef.current.has(base64)) return;

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

  const queueDelete = useCallback((base64: string) => {
    syncQueueRef.current = syncQueueRef.current.filter(
      op => !(op.type === 'upload' && op.payload === base64)
    );

    if (imageToFileIdRef.current.has(base64)) {
      syncQueueRef.current.push({
        type: 'delete',
        payload: base64,
        retries: 0,
      });

      scheduleProcessQueue();
    }
  }, [scheduleProcessQueue]);

  const shiftNextOp = useCallback((): QueueOperation | undefined => {
    return syncQueueRef.current.shift();
  }, []);

  const pushFailedOps = useCallback((ops: QueueOperation[]) => {
    syncQueueRef.current.push(...ops);
  }, []);

  const setMapping = useCallback((base64: string, fileId: string) => {
    imageToFileIdRef.current.set(base64, fileId);
  }, []);

  const getMapping = useCallback((base64: string): string | undefined => {
    return imageToFileIdRef.current.get(base64);
  }, []);

  const deleteMapping = useCallback((base64: string) => {
    imageToFileIdRef.current.delete(base64);
  }, []);

  const hasMapping = useCallback((base64: string): boolean => {
    return imageToFileIdRef.current.has(base64);
  }, []);

  const hasPendingOps = useCallback((): boolean => {
    return syncQueueRef.current.length > 0;
  }, []);

  const beginProcessing = useCallback((): boolean => {
    if (isProcessingRef.current) return false;
    isProcessingRef.current = true;
    return true;
  }, []);

  const endProcessing = useCallback((): void => {
    isProcessingRef.current = false;
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (processTimerRef.current) {
        clearTimeout(processTimerRef.current);
      }
    };
  }, []);

  return {
    queueUpload,
    queueDelete,
    scheduleProcessQueue,
    registerProcessor,
    clearTimer,
    shiftNextOp,
    pushFailedOps,
    setMapping,
    getMapping,
    deleteMapping,
    hasMapping,
    hasPendingOps,
    beginProcessing,
    endProcessing,
  };
};
