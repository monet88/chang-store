/**
 * Toast notification system
 *
 * Provides context-based toast notifications with auto-dismiss.
 * Used for feedback messages like "Image saved to Gallery".
 */
import React, { useEffect, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { CheckCircleIcon } from './Icons';

/** Single toast message */
interface ToastMessage {
  id: number;
  message: string;
}

/** Toast context type for consuming components */
interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Hook to access toast functionality
 * @throws Error if used outside ToastProvider
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

/**
 * Toast provider component
 * Wraps app content and manages toast state
 */
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container - fixed bottom right */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} message={toast.message} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * Individual toast item with auto-dismiss
 */
const ToastItem: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
      <CheckCircleIcon className="w-5 h-5 text-green-400" />
      <span className="text-sm">{message}</span>
    </div>
  );
};
