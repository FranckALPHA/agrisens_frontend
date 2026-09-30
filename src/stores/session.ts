/**
 * Store de session utilisateur Zustand (Q-25 et F-01 point 7).
 * Le jeton d'accès JWT est conservé STRICTEMENT en mémoire vive (pas de localStorage ni sessionStorage).
 */

import { create } from 'zustand';
import type { components } from '@/services/api/schema';

export type UtilisateurApi = components['schemas']['Utilisateur'];

export interface UtilisateurSession {
  id: string;
  telephone: string;
  email?: string | null;
  nom: string;
  role: 'acheteur' | 'agriculteur' | 'ingenieur_agronome' | 'livreur' | 'admin' | 'super_admin';
  statutCompte: 'actif' | 'en_attente_validation' | 'suspendu' | 'anonymise';
  region?: string | null;
  /** Drapeau de changement obligatoire (mot de passe temporaire admin, F-02). */
  doitChangerMotDePasse?: boolean;
}

/** Convertit l'utilisateur de l'API (snake_case) en session frontend (camelCase). */
export function mapperUtilisateur(u: UtilisateurApi): UtilisateurSession {
  return {
    id: u.id,
    telephone: u.telephone,
    email: u.email,
    nom: u.nom,
    role: u.role as UtilisateurSession['role'],
    statutCompte: u.statut_compte as UtilisateurSession['statutCompte'],
    region: u.region,
    doitChangerMotDePasse: u.doit_changer_mot_de_passe,
  };
}

interface EtatSession {
  token: string | null;
  utilisateur: UtilisateurSession | null;
  estConnecte: boolean;
  estInitialise: boolean;
  definirSession: (token: string, utilisateur: UtilisateurSession) => void;
  definirJeton: (token: string) => void;
  definirUtilisateur: (utilisateur: UtilisateurSession) => void;
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

  // Le jeton seul change après rafraîchissement silencieux ; l'utilisateur
  // peut être mis à jour séparément si la réponse apporte un profil neuf.
  definirJeton: (token) => set({ token, estConnecte: true, estInitialise: true }),

  // Après PATCH moi ou changement de mot de passe : profil rafraîchi, jeton inchangé.
  definirUtilisateur: (utilisateur) => set({ utilisateur }),

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
