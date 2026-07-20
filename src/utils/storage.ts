import { ImageFile, LookbookSet } from '../types';

/**
 * Session persistence utilities
 */
export const saveSessionState = (key: string, data: any): void => {
  try {
    localStorage.setItem(`cs_session_${key}`, JSON.stringify(data));
  } catch (error) {
    console.error(`[Storage] Failed to save session ${key}:`, error);
  }
};

export const getSessionState = <T>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(`cs_session_${key}`);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (error) {
    console.error(`[Storage] Failed to get session ${key}:`, error);
    return defaultValue;
  }
};

export const getSavedLookbookSets = (): LookbookSet[] => {
  return [];
};

export const saveLookbookSet = (images: ImageFile[]): LookbookSet => {
  if (images.length === 0) {
      throw new Error("Cannot save an empty lookbook set.");
  }

  const newSet: LookbookSet = {
    id: `lookbook-${crypto.randomUUID()}`,
    createdAt: Date.now(),
    images: images,
  };

  return newSet;
};

export const deleteLookbookSet = (id: string): void => {
  // No-op
};

export const getLocalStorageUsage = async (): Promise<{ usage: number, quota: number }> => {
    return { usage: 0, quota: 0 };
};

export const backupData = () => {
    alert('Data backup is currently disabled.');
};

export const restoreData = (file: File): Promise<void> => {
    return new Promise((_, reject) => {
        reject(new Error('Data restore is currently disabled.'));
    });
};

export const clearAppData = async (): Promise<void> => {
    // No-op
};
