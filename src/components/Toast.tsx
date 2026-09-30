/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type TypeToast = 'succes' | 'erreur' | 'info';

export interface ToastItem {
  id: string;
  type: TypeToast;
  message: string;
  dureeMs?: number;
}

interface ContexteToast {
  afficherToast: (message: string, type?: TypeToast, dureeMs?: number) => void;
}

const ContexteToastGlobal = createContext<ContexteToast | null>(null);

export const useToast = (): ContexteToast => {
  const ctx = useContext(ContexteToastGlobal);
  if (!ctx) {
    throw new Error('useToast doit être utilisé à l’intérieur d’un FournisseurToast.');
  }
  return ctx;
};

export const FournisseurToast: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const retirerToast = useCallback((id: string) => {
    setToasts((precedent) => precedent.filter((t) => t.id !== id));
  }, []);

  const afficherToast = useCallback(
    (message: string, type: TypeToast = 'info', dureeMs = 4000) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((precedent) => [...precedent, { id, type, message, dureeMs }]);

      if (dureeMs > 0) {
        setTimeout(() => retirerToast(id), dureeMs);
      }
    },
    [retirerToast]
  );

  return (
    <ContexteToastGlobal.Provider value={{ afficherToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-lg shadow-lg border text-sm font-medium transition-all animate-in slide-in-from-bottom-2 ${
              toast.type === 'succes'
                ? 'bg-succes-fond text-succes-texte border-emerald-300'
                : toast.type === 'erreur'
                  ? 'bg-erreur-fond text-erreur-texte border-red-300'
                  : 'bg-info-fond text-info-texte border-sky-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'succes' && <CheckCircle2 size={18} aria-hidden="true" />}
              {toast.type === 'erreur' && <AlertCircle size={18} aria-hidden="true" />}
              {toast.type === 'info' && <Info size={18} aria-hidden="true" />}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => retirerToast(toast.id)}
              aria-label="Fermer la notification"
              className="p-1 rounded hover:bg-black/5 focus:outline-none"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ContexteToastGlobal.Provider>
  );
};
