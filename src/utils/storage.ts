


import { ImageFile, LookbookSet } from '../types';

export const getSavedLookbookSets = (): LookbookSet[] => {
  return [];
};

export const saveLookbookSet = (images: ImageFile[]): LookbookSet => {
  if (images.length === 0) {
      throw new Error("Cannot save an empty lookbook set.");
  }

  const newSet: LookbookSet = {
    id: `lookbook-${Date.now()}`,
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

export const clearAppData = () => {
    // No-op
};
