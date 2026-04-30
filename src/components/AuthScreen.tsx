import React, { useCallback, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import Spinner from './Spinner';

export const AuthScreen: React.FC = () => {
  const { t } = useLanguage();
  const { login, authError, clearError, isAuthenticating } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    await login(username, password).catch(() => undefined);
  }, [clearError, login, password, username]);

  return (
    <div className="min-h-screen bg-transparent text-zinc-100">
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="workspace-shell w-full max-w-md rounded-[2rem] p-6 sm:p-8">
          <div className="space-y-3 text-center">
            <p className="workspace-label">{t('auth.eyebrow')}</p>
            <h1 className="text-3xl font-medium tracking-[-0.04em] text-zinc-50 sm:text-4xl">
              {t('auth.title')}
            </h1>
            <p className="text-sm leading-6 text-zinc-400 sm:text-base">
              {t('auth.description')}
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-300">{t('auth.fields.username')}</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="workspace-input min-h-[46px] w-full px-4 py-3 text-sm text-zinc-100"
                placeholder={t('auth.placeholders.username')}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-300">{t('auth.fields.password')}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="workspace-input min-h-[46px] w-full px-4 py-3 text-sm text-zinc-100"
                placeholder={t('auth.placeholders.password')}
              />
            </label>

            {authError && (
              <div className="rounded-[1rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className="workspace-button workspace-button-primary w-full px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAuthenticating ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  {t('auth.actions.loggingIn')}
                </span>
              ) : t('auth.actions.login')}
            </button>
          </form>

          {import.meta.env.DEV && (
            <p className="mt-5 rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-zinc-400">
              {t('auth.devHint')}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default AuthScreen;
