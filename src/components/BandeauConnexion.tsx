import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { MESSAGES } from '@/theme/messages';

export const BandeauConnexion: React.FC = () => {
  const [estHorsLigne, setEstHorsLigne] = useState(!navigator.onLine);

  useEffect(() => {
    const gererEnLigne = () => setEstHorsLigne(false);
    const gererHorsLigne = () => setEstHorsLigne(true);

    window.addEventListener('online', gererEnLigne);
    window.addEventListener('offline', gererHorsLigne);

    return () => {
      window.removeEventListener('online', gererEnLigne);
      window.removeEventListener('offline', gererHorsLigne);
    };
  }, []);

  if (!estHorsLigne) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="bg-amber-600 text-white px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-all"
    >
      <WifiOff size={18} aria-hidden="true" className="shrink-0" />
      <span>{MESSAGES.horsLigne}</span>
    </aside>
  );
};
