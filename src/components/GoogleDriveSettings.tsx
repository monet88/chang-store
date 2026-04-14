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

function formatRelativeTime(
  date: Date | null,
  t: (key: string, params?: Record<string, string | number>) => string,
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

const statusToneMap = {
  idle: 'text-zinc-400',
  syncing: 'text-zinc-200',
  synced: 'text-emerald-300',
  error: 'text-red-300',
} as const;

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

  const renderSyncStatusIcon = () => {
    if (isLoadingFromDrive || syncStatus === 'syncing') {
      return <Spinner />;
    }
    if (syncStatus === 'error' || syncError) {
      return <WarningIcon className="h-4 w-4 text-red-300" />;
    }
    if (syncStatus === 'synced') {
      return <CheckCircleIcon className="h-4 w-4 text-emerald-300" />;
    }
    return <CloudIcon className="h-4 w-4 text-zinc-400" />;
  };

  const getSyncStatusText = (): string => {
    if (isLoadingFromDrive) return t('googleDrive.status.syncing');
    return t(`googleDrive.status.${syncStatus}`);
  };

  const handleForceSync = async () => {
    await forceSync();
  };

  const handleClearErrors = () => {
    clearError();
    clearSyncError();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.02] px-4 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-zinc-100">
          <CloudIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="workspace-label mb-1">{t('googleDrive.title')}</p>
          <p className="text-sm leading-6 text-zinc-400">{t('googleDrive.description')}</p>
        </div>
      </div>

      {!isConnected && (
        <div className="space-y-3 rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
          <button
            onClick={signIn}
            disabled={isAuthenticating}
            className="workspace-button workspace-button-primary w-full px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAuthenticating ? (
              <>
                <Spinner />
                <span>{t('googleDrive.connecting')}</span>
              </>
            ) : (
              <>
                <CloudIcon className="h-4 w-4" />
                <span>{t('googleDrive.connect')}</span>
              </>
            )}
          </button>

          {authError && (
            <div className="flex items-start gap-2 rounded-[1rem] border border-red-500/20 bg-red-500/10 p-3">
              <WarningIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
              <p className="text-xs leading-5 text-red-200">{authError}</p>
            </div>
          )}

          <p className="text-xs leading-5 text-zinc-500">{t('googleDrive.privacyNote')}</p>
        </div>
      )}

      {isConnected && user && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                <span className="text-sm font-semibold text-zinc-200">{user.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100 truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
            <span className="workspace-chip px-3 py-1 text-xs font-medium text-zinc-300">{t('googleDrive.connected')}</span>
          </div>

          <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {renderSyncStatusIcon()}
                <span className={`text-sm font-medium ${statusToneMap[syncStatus]}`}>{getSyncStatusText()}</span>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                {t('googleDrive.lastSynced')}: {formatRelativeTime(lastSynced, t)}
              </p>
            </div>
          </div>

          {syncError && (
            <div className="flex items-start justify-between gap-3 rounded-[1rem] border border-red-500/20 bg-red-500/10 p-3">
              <div className="flex items-start gap-2">
                <WarningIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                <p className="text-xs leading-5 text-red-200">{syncError}</p>
              </div>
              <button onClick={handleClearErrors} className="text-xs font-medium uppercase tracking-[0.14em] text-red-200 transition hover:text-white">
                {t('googleDrive.dismiss')}
              </button>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <button
              onClick={handleForceSync}
              disabled={syncStatus === 'syncing' || isLoadingFromDrive}
              className="workspace-button px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshIcon className="h-4 w-4" />
              <span>{t('googleDrive.syncNow')}</span>
            </button>
            <button onClick={signOut} className="workspace-button px-4 py-3 text-sm font-medium text-red-300 hover:text-red-200">
              {t('googleDrive.disconnect')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleDriveSettings;
