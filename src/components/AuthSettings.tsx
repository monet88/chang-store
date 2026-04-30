import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export const AuthSettings: React.FC = () => {
  const { t } = useLanguage();
  const { user, logout, isAuthenticating } = useAuth();

  return (
    <div className="space-y-4">
      <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4">
        <p className="workspace-label mb-2">{t('auth.settings.currentAccount')}</p>
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-100">{user?.displayName ?? t('auth.settings.unknownUser')}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{user?.username ?? '—'}</p>
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.02] p-4 text-sm leading-6 text-zinc-400">
        <p>{t('auth.settings.sessionDescription')}</p>
      </div>

      <button
        onClick={() => void logout()}
        disabled={isAuthenticating}
        className="workspace-button w-full px-4 py-3 text-sm font-medium text-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t('auth.actions.logout')}
      </button>
    </div>
  );
};

export default AuthSettings;
