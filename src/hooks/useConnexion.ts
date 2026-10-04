/**
 * Hook d'état de connexion réseau (F-15).
 *
 * Reflète `navigator.onLine` en temps réel via les événements `online` /
 * `offline`. Utilisé pour désactiver les actions sensibles au réseau (paiement)
 * hors ligne — elles ne sont **jamais** mises en file (SPEC-12 §3).
 */
import { useEffect, useState } from 'react';

export function useConnexion(): boolean {
  const [enLigne, setEnLigne] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const passerEnLigne = () => setEnLigne(true);
    const passerHorsLigne = () => setEnLigne(false);
    window.addEventListener('online', passerEnLigne);
    window.addEventListener('offline', passerHorsLigne);
    return () => {
      window.removeEventListener('online', passerEnLigne);
      window.removeEventListener('offline', passerHorsLigne);
    };
  }, []);

  return enLigne;
}
