/**
 * Tauri Native API Bindings
 *
 * Provides TypeScript interfaces for interacting with native Tauri features:
 * - File system operations (save images locally)
 * - Desktop notifications
 * - File dialogs (open/save)
 * - App data directory access
 *
 * @module services/tauriService
 */

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

// ============================================================================
// Type Definitions
// ============================================================================

/** Supported image formats for saving */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/** Options for saving an image */
export interface SaveImageOptions {
  /** Base64 encoded image data (with or without data URL prefix) */
  base64Data: string;
  /** Suggested filename (without extension) */
  filename?: string;
  /** Image format */
  format?: ImageFormat;
}

/** Result of a save operation */
export interface SaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if running inside Tauri desktop app
 *
 * @returns true if running in Tauri, false if in browser
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// ============================================================================
// File System Operations
// ============================================================================

/**
 * Save an image to the local file system using native dialog
 *
 * Opens a save dialog, then writes the image data to the selected path.
 * Falls back to browser download if not running in Tauri.
 *
 * @param options - Save options including base64 data and filename
 * @returns Save result with success status and file path
 *
 * @example
 * const result = await saveImageToLocal({
 *   base64Data: 'iVBORw0KGgo...',
 *   filename: 'generated-lookbook',
 *   format: 'png'
 * });
 */
export async function saveImageToLocal(
  options: SaveImageOptions
): Promise<SaveResult> {
  const { base64Data, filename = 'image', format = 'png' } = options;

  // Fallback for browser environment
  if (!isTauri()) {
    return saveImageBrowser(base64Data, `${filename}.${format}`);
  }

  try {
    // Open native save dialog
    const filePath = await save({
      defaultPath: `${filename}.${format}`,
      filters: [
        {
          name: 'Images',
          extensions: [format],
        },
      ],
    });

    if (!filePath) {
      return { success: false, error: 'Save cancelled by user' };
    }

    // Call Rust backend to save file
    const savedPath = await invoke<string>('save_image_to_file', {
      base64Data,
      filePath,
    });

    return { success: true, filePath: savedPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Browser fallback for saving images
 *
 * @param base64Data - Base64 encoded image data
 * @param filename - Target filename with extension
 * @returns Save result
 */
function saveImageBrowser(base64Data: string, filename: string): SaveResult {
  try {
    // Ensure data URL format
    let dataUrl = base64Data;
    if (!base64Data.startsWith('data:')) {
      dataUrl = `data:image/png;base64,${base64Data}`;
    }

    // Create download link
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Open file dialog to select an image
 *
 * @returns Selected file path or null if cancelled
 */
export async function openImageDialog(): Promise<string | null> {
  if (!isTauri()) {
    console.warn('openImageDialog only available in Tauri');
    return null;
  }

  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
        },
      ],
    });

    return selected as string | null;
  } catch (error) {
    console.error('Failed to open file dialog:', error);
    return null;
  }
}

// ============================================================================
// Notifications
// ============================================================================

/**
 * Send a desktop notification
 *
 * Automatically requests permission if not already granted.
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @returns true if notification was sent successfully
 *
 * @example
 * await sendDesktopNotification('Generation Complete', 'Your lookbook is ready!');
 */
export async function sendDesktopNotification(
  title: string,
  body: string
): Promise<boolean> {
  if (!isTauri()) {
    // Browser fallback using Notification API
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
        return true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body });
          return true;
        }
      }
    }
    return false;
  }

  try {
    let permissionGranted = await isPermissionGranted();

    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    if (permissionGranted) {
      sendNotification({ title, body });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

// ============================================================================
// App Data
// ============================================================================

/**
 * Get the app data directory path
 *
 * @returns Path to app data directory or null if not in Tauri
 */
export async function getAppDataDir(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }

  try {
    return await invoke<string>('get_app_data_dir');
  } catch (error) {
    console.error('Failed to get app data dir:', error);
    return null;
  }
}
