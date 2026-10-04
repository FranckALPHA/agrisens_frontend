/**
 * Service de session (prompt F-02 frontend point 4).
 * - Rafraîchissement silencieux au chargement de l'application (cookie httpOnly).
 * - Sur 401, une seule tentative de renouvellement, partagée entre requêtes
 *   concurrentes (rotation du jeton : deux rafraîchissements en parallèle
 *   provoqueraient une révocation de toutes les sessions).
 * - Déconnexion locale + appel API.
 */

import { definirCrochetRafraichissement } from '@/services/api/client';
import {
  rafraichirSessionHttp,
  deconnecterSession,
  connecter,
  inscrire,
  type ConnexionDonnees,
  type InscriptionDonnees,
} from '@/services/api/auth';
import { mapperUtilisateur, useSessionStore, type UtilisateurSession } from '@/stores/session';
import { demarrerPersistance, purgerCache } from '@/services/persistance';

let rafraichissementEnCours: Promise<string | null> | null = null;
let initialisationEnCours: Promise<void> | null = null;

/**
 * Renouvelle la session via le cookie. Une seule tentative en vol ; les
 * requêtes 401 concurrentes attendent le même résultat. Renvoie le nouveau
 * jeton d'accès, ou null si la session est définitivement perdue (auquel cas
 * le store est remis à vide et l'interface redirigera vers /connexion).
 */
export function rafraichirSession(): Promise<string | null> {
  if (!rafraichissementEnCours) {
    rafraichissementEnCours = executerRafraichissement().finally(() => {
      rafraichissementEnCours = null;
    });
  }
  return rafraichissementEnCours;
}

async function executerRafraichissement(): Promise<string | null> {
  const store = useSessionStore.getState();
  try {
    const donnees = await rafraichirSessionHttp();
    if (donnees && donnees.jeton_acces) {
      store.definirSession(donnees.jeton_acces, mapperUtilisateur(donnees.utilisateur));
      // F-15 : reprise de session (cookie) → relancer la persistance du cache.
      demarrerPersistance(donnees.utilisateur.id);
      return donnees.jeton_acces;
    }
  } catch {
    // Erreur réseau : ne pas déconnecter sur une simple coupure Internet,
    // le jeton local reste utilisable et la bannière hors ligne avertit.
    return useSessionStore.getState().token;
  }
  // Ni cookie valide, ni rotation possible : session perdue.
  store.deconnecter();
  return null;
}

/**
 * Initialisation au chargement : si un cookie de rafraîchissement survit,
 * /auth/rafraichir rétablit une session complète sans reconnexion (PW-F02-08).
 */
export function initialiserSession(): Promise<void> {
  if (!initialisationEnCours) {
    initialisationEnCours = executerInitialisation().finally(() => {
      initialisationEnCours = null;
    });
  }
  return initialisationEnCours;
}

async function executerInitialisation(): Promise<void> {
  const store = useSessionStore.getState();
  if (store.estConnecte) {
    store.marquerInitialise();
    return;
  }
  try {
    const donnees = await rafraichirSessionHttp();
    if (donnees && donnees.jeton_acces) {
      store.definirSession(donnees.jeton_acces, mapperUtilisateur(donnees.utilisateur));
      // F-15 : rechargement à froid connecté → écrans déjà consultés relisible hors ligne.
      demarrerPersistance(donnees.utilisateur.id);
    } else {
      store.marquerInitialise();
    }
  } catch {
    // API injoignable : on laisse l'interface se rendre compte que l'état
    // n'est pas initialisé plutôt que d'affirmer une déconnexion.
    useSessionStore.getState().marquerInitialise();
  }
}

/** Ouvre une session après inscription ou connexion réussie. */
export function etablirSession(donnees: {
  jeton_acces: string;
  utilisateur: Parameters<typeof mapperUtilisateur>[0];
}): UtilisateurSession {
  const session = mapperUtilisateur(donnees.utilisateur);
  useSessionStore.getState().definirSession(donnees.jeton_acces, session);
  // F-15 : activer la persistance TanStack Query pour cet utilisateur.
  demarrerPersistance(session.id);
  return session;
}

/** Déconnexion complète : API (rotation révoquée) puis store + purge cache IndexedDB. */
export async function seDeconnecter(): Promise<void> {
  const userId = useSessionStore.getState().utilisateur?.id;
  await deconnecterSession();
  useSessionStore.getState().deconnecter();
  // F-15 : aucune donnée privée ne reste après déconnexion.
  if (userId) {
    await purgerCache(userId);
  }
}

/** Connexion via le formulaire (identifiant = téléphone ou email). */
export async function seConnecter(donnees: ConnexionDonnees): Promise<UtilisateurSession> {
  const reponse = await connecter(donnees);
  return etablirSession(reponse);
}

/** Inscription puis ouverture directe de la session. */
export async function sInscrire(donnees: InscriptionDonnees): Promise<UtilisateurSession> {
  const reponse = await inscrire(donnees);
  return etablirSession(reponse);
}

// Le client HTTP demande au service de session comment renouveler un jeton.
definirCrochetRafraichissement(rafraichirSession);
