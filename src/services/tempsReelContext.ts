/**
 * Contexte du temps réel (F-13) : sépare les exports non-composants
 * (`deriverUrlWs`, `useTempsReel`, `Contexte`) du fournisseur pour garder
 * `tempsReel.tsx` strictement composant (règle react-refresh).
 */

import { createContext, useContext } from 'react';

export type StatutConnexion = 'connexion' | 'connecte' | 'hors_ligne';

/**
 * Dérive l'URL du canal WebSocket de l'origine HTTP de l'API.
 * `http(s)://hote[:port]` → `ws(s)://hote[:port]/ws`. Exportée pour les tests.
 */
export function deriverUrlWs(baseHttp: string): string {
  const sansSlash = baseHttp.replace(/\/+$/, '');
  const urlWs = sansSlash.replace(/^http/, 'ws');
  return `${urlWs}/ws`;
}

export interface ContexteTempsReel {
  statut: StatutConnexion;
}

export const Contexte = createContext<ContexteTempsReel>({ statut: 'hors_ligne' });

export function useTempsReel(): ContexteTempsReel {
  return useContext(Contexte);
}
