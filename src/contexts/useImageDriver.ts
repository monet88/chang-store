import React, { createContext, useContext } from 'react';
import type { ImageFile } from '../types';
import {
  type ImageDriver,
  type GenerateJob,
  type UpscaleJob,
  type ReferenceRoleImage,
  type StudioDriverErrorCode,
  StudioDriverError,
  isStudioDriverError,
  isRetryableDriverError,
} from '../services/providers/ImageDriver';
import { useOptionalImageEngine } from './ImageEngineContext';

export type {
  ImageDriver,
  GenerateJob,
  UpscaleJob,
  ReferenceRoleImage,
  StudioDriverErrorCode,
  ImageFile,
};

export {
  StudioDriverError,
  isStudioDriverError,
  isRetryableDriverError,
};

export const ImageDriverContext = createContext<ImageDriver | null>(null);

export interface ImageDriverProviderProps {
  driver: ImageDriver;
  children: React.ReactNode;
}

/**
 * Standalone provider for ImageDriver.
 * Primarily used in test harnesses (injecting InMemoryImageDriverFake)
 * or isolated sub-trees.
 */
export const ImageDriverProvider: React.FC<ImageDriverProviderProps> = ({ driver, children }) => {
  return React.createElement(ImageDriverContext.Provider, { value: driver }, children);
};

/**
 * Accesses the active ImageDriver if mounted, or null if outside a driver/engine tree.
 */
export const useOptionalImageDriver = (): ImageDriver | null => {
  const driver = useContext(ImageDriverContext);
  const engine = useOptionalImageEngine();

  if (driver) {
    return driver;
  }

  if (engine?.driver) {
    return engine.driver;
  }

  return null;
};

/**
 * Accesses the active ImageDriver for executing image generation and upscale jobs.
 *
 * Resolves from:
 * 1. An explicit ImageDriverContext.Provider (e.g. testing with InMemoryImageDriverFake)
 * 2. The active ImageEngineContext.Provider (production studio mode)
 * 3. Dynamic bridge if only legacy useImageEngine is mocked in tests
 *
 * Throws if none is mounted.
 */
export const useImageDriver = (): ImageDriver => {
  const driver = useOptionalImageDriver();
  if (driver) {
    return driver;
  }

  throw new Error('useImageDriver must be used inside ImageDriverProvider or ImageEngineProvider');
};
