import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { MESSAGES } from '@/theme/messages';

export const BandeauMiseAJour: React.FC = () => {
  const [miseAJourDisponible, setMiseAJourDisponible] = useState(false);
  const [attenteWorker, setAttenteWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;

        reg.addEventListener('updatefound', () => {
          const nouveauWorker = reg.installing;
          if (!nouveauWorker) return;

          nouveauWorker.addEventListener('statechange', () => {
            if (nouveauWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setAttenteWorker(nouveauWorker);
              setMiseAJourDisponible(true);
            }
          });
        });
      });
    }
  }, []);

  const appliquerMiseAJour = () => {
    if (attenteWorker) {
      attenteWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  if (!miseAJourDisponible) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-3 p-4 rounded-lg bg-surface border border-primaire shadow-lg text-texte text-sm"
    >
      <RefreshCw size={18} className="text-primaire shrink-0 animate-spin" aria-hidden="true" />
      <span>{MESSAGES.nouvelleVersion}</span>
      <div className="flex items-center gap-2 ml-2">
        <Bouton taille="sm" variante="primaire" onClick={appliquerMiseAJour}>
          {MESSAGES.mettreAJour}
        </Bouton>
        <button
          type="button"
          onClick={() => setMiseAJourDisponible(false)}
          className="p-1 rounded text-texte-muet hover:text-texte focus:outline-none"
          aria-label="Ignorer la mise à jour"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
