/**
 * Page hors connexion (F-15, SPEC-12 §1).
 * Affichée par le service worker (navigateFallback) quand aucune ressource
 * n'est disponible dans le cache.
 */

import React from 'react';
import { WifiOff } from 'lucide-react';
import { MESSAGES } from '@/theme/messages';

export const PageHorsConnexion: React.FC = () => {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-fond text-texte"
      data-testid="page-hors-connexion"
    >
      <WifiOff size={48} className="text-amber-600" aria-hidden="true" />
      <h1 className="text-lg font-semibold">{MESSAGES.pageHorsConnexion}</h1>
      <p className="text-sm text-texte-secondaire max-w-xs">{MESSAGES.pageHorsConnexionDetail}</p>
    </div>
  );
};

export default PageHorsConnexion;
