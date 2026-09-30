/**
 * Store de session utilisateur Zustand (Q-25 et F-01 point 7).
 * Le jeton d'accès JWT est conservé STRICTEMENT en mémoire vive (pas de localStorage ni sessionStorage).
 */

import { create } from 'zustand';

export interface UtilisateurSession {
  id: string;
  telephone: string;
  email?: string | null;
  nom: string;
  role: 'acheteur' | 'agriculteur' | 'ingenieur_agronome' | 'livreur' | 'admin' | 'super_admin';
  statutCompte: 'actif' | 'en_attente_validation' | 'suspendu' | 'anonymise';
  region?: string | null;
}

interface EtatSession {
  token: string | null;
  utilisateur: UtilisateurSession | null;
  estConnecte: boolean;
  estInitialise: boolean;
  definirSession: (token: string, utilisateur: UtilisateurSession) => void;
  deconnecter: () => void;
  marquerInitialise: () => void;
}

export const useSessionStore = create<EtatSession>((set) => ({
  token: null,
  utilisateur: null,
  estConnecte: false,
  estInitialise: false,

  definirSession: (token, utilisateur) =>
    set({
      token,
      utilisateur,
      estConnecte: true,
      estInitialise: true,
    }),

  deconnecter: () =>
    set({
      token: null,
      utilisateur: null,
      estConnecte: false,
      estInitialise: true,
    }),

  marquerInitialise: () => set({ estInitialise: true }),
}));

if (typeof window !== 'undefined') {
  (window as unknown as { __sessionStore: typeof useSessionStore }).__sessionStore =
    useSessionStore;
}
