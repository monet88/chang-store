/**
 * Google Drive Settings Component
 *
 * Displays connection status and sync controls for Google Drive integration.
 * Used within SettingsModal to allow users to connect/disconnect Drive.
 *
 * @see contexts/GoogleDriveContext.tsx for OAuth logic
 * @see contexts/ImageGalleryContext.tsx for sync state
 */

import React from 'react';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CloudIcon, RefreshIcon, WarningIcon, CheckCircleIcon } from './Icons';
import Spinner from './Spinner';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats a Date into a relative time string
 * @param date - Date to format
 * @param t - Translation function
 */
function formatRelativeTime(
  date: Date | null,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (!date) return t('googleDrive.never');

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return t('googleDrive.justNow');
  if (diffMinutes < 60) return t('googleDrive.minutesAgo', { count: diffMinutes });

  const diffHours = Math.floor(diffMinutes / 60);
  return t('googleDrive.hoursAgo', { count: diffHours });
}

// ============================================================================
// Component
// ============================================================================

export const GoogleDriveSettings: React.FC = () => {
  const { t } = useLanguage();
  const {
    isConnected,
    user,
    isAuthenticating,
    authError,
    signIn,
    signOut,
    clearError,
  } = useGoogleDrive();

  const {
    syncStatus,
    lastSynced,
    syncError,
    isLoadingFromDrive,
    forceSync,
    clearSyncError,
  } = useImageGallery();

  // --- Sync Status Icon ---
  const renderSyncStatusIcon = () => {
    if (isLoadingFromDrive || syncStatus === 'syncing') {
      return <Spinner />;
    }
    if (syncStatus === 'error' || syncError) {
      return <WarningIcon className="w-4 h-4 text-red-400" />;
    }
    if (syncStatus === 'synced') {
      return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
    }
    return <CloudIcon className="w-4 h-4 text-slate-400" />;
  };

  // --- Sync Status Text ---
  const getSyncStatusText = (): string => {
    if (isLoadingFromDrive) return t('googleDrive.status.syncing');
    return t(`googleDrive.status.${syncStatus}`);
  };

  // --- Handle Force Sync ---
  const handleForceSync = async () => {
    await forceSync();
  };

  // --- Handle Clear Errors ---
  const handleClearErrors = () => {
    clearError();
    clearSyncError();
  };

  return (
    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <CloudIcon className="w-5 h-5 text-amber-400" />
        <h4 className="font-semibold text-slate-200">{t('googleDrive.title')}</h4>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        {t('googleDrive.description')}
      </p>

      {/* Disconnected State */}
      {!isConnected && (
        <div className="space-y-3">
          <button
            onClick={signIn}
            disabled={isAuthenticating}
            className="w-full bg-amber-600 text-white font-semibold py-2.5 px-4 rounded-lg text-sm hover:bg-amber-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAuthenticating ? (
              <>
                <Spinner />
                <span>{t('googleDrive.connecting')}</span>
              </>
            ) : (
              <>
                <CloudIcon className="w-4 h-4" />
                <span>{t('googleDrive.connect')}</span>
              </>
            )}
          </button>

          {authError && (
            <div className="flex items-start gap-2 p-2 bg-red-900/30 rounded-lg border border-red-800">
              <WarningIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{authError}</p>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center">
            {t('googleDrive.privacyNote')}
          </p>
        </div>
      )}

      {/* Connected State */}
      {isConnected && user && (
        <div className="space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                <span className="text-lg font-semibold text-slate-300">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-200 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Sync Status */}
          <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-2">
              {renderSyncStatusIcon()}
              <span className="text-sm text-slate-300">{getSyncStatusText()}</span>
            </div>
            <div className="text-xs text-slate-400">
              {t('googleDrive.lastSynced')}: {formatRelativeTime(lastSynced, t)}
            </div>
          </div>

          {/* Sync Error */}
          {syncError && (
            <div className="flex items-start justify-between gap-2 p-2 bg-red-900/30 rounded-lg border border-red-800">
              <div className="flex items-start gap-2">
                <WarningIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{syncError}</p>
              </div>
              <button
                onClick={handleClearErrors}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleForceSync}
              disabled={syncStatus === 'syncing' || isLoadingFromDrive}
              className="flex-1 bg-slate-700 text-white font-medium py-2 px-4 rounded-lg text-sm hover:bg-slate-600 transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <RefreshIcon className="w-4 h-4" />
              <span>{t('googleDrive.syncNow')}</span>
            </button>
            <button
              onClick={signOut}
              className="bg-slate-700 text-red-400 font-medium py-2 px-4 rounded-lg text-sm hover:bg-slate-600 transition-colors"
            >
              {t('googleDrive.disconnect')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleDriveSettings;
