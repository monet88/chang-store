import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import Spinner from './Spinner';
import AuthScreen from './AuthScreen';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  const { status } = useAuth();

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-zinc-200">
        <Spinner />
        <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">{t('auth.status.checking')}</p>
      </div>
    );
  }

  if (status === 'anonymous') {
    return <AuthScreen />;
  }

  return <>{children}</>;
};

export default AuthGate;
