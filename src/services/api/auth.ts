/**
 * Services d'authentification, profil et adresses (F-02, SPEC-01).
 * Enveloppe le client typé : les erreurs HTTP sont déjà converties en
 * ErreurApi par le middleware de `client.ts` ; les erreurs réseau (fetch
 * lève un TypeError) sont normalisées ici pour que les pages distinguent
 * « hors ligne » d'une erreur métier (prompt F-02, FE-02 connexion faible).
 */

import { apiClient, ErreurApi, PREFICE_API_V1 } from './client';
import type { components } from './schema';

export type InscriptionDonnees = components['schemas']['InscriptionRequest'];
export type ConnexionDonnees = components['schemas']['ConnexionRequest'];
export type ModificationMoiDonnees = components['schemas']['PatchedMiseAJourMoiRequest'];
export type MotDePasseDonnees = components['schemas']['MotDePasseRequest'];
export type AdresseCreationDonnees = components['schemas']['AdresseCreationRequest'];
export type AdresseModificationDonnees = components['schemas']['PatchedAdresseModificationRequest'];
export type ReponseSession = components['schemas']['ReponseSession'];
export type Adresse = components['schemas']['Adresse'];
export type Utilisateur = components['schemas']['Utilisateur'];

/** Code d'erreur utilisé quand le réseau est injoignable (pas de réponse HTTP). */
export const CODE_ERREUR_RESEAU = 'reseau_injoignable';

/** Normalise toute exception rencontrée lors d'un appel API en ErreurApi. */
export function normaliserErreur(err: unknown): ErreurApi {
  if (err instanceof ErreurApi) return err;
  if (err instanceof TypeError) {
    // fetch lève un TypeError quand le serveur est injoignable (hors ligne,
    // DNS, CORS, connexion coupée en cours d'envoi).
    return new ErreurApi(
      CODE_ERREUR_RESEAU,
      'Impossible de contacter le serveur. Vérifiez votre connexion Internet.',
      0
    );
  }
  return new ErreurApi('erreur_inattendue', 'Une erreur inattendue est survenue.', 0);
}

// --- Authentification -------------------------------------------------------

/** POST /auth/inscription — crée le compte et établit la session. */
export async function inscrire(donnees: InscriptionDonnees): Promise<ReponseSession> {
  const { data, error } = await apiClient.POST('/api/v1/auth/inscription/', { body: donnees });
  if (!data) throw erreurDepuisReponse(error, donnees);
  return data as ReponseSession;
}

/** POST /auth/connexion — téléphone ou email + mot de passe. */
export async function connecter(donnees: ConnexionDonnees): Promise<ReponseSession> {
  const { data, error } = await apiClient.POST('/api/v1/auth/connexion/', { body: donnees });
  if (!data) throw erreurDepuisReponse(error, donnees);
  return data as ReponseSession;
}

/**
 * POST /auth/rafraichir — rotation du jeton via le cookie httpOnly.
 * Appel fetch direct : le middleware ne rejouerait pas correctement une
 * route publique et le corps de réponse doit rester brut (cookie porté par
 * le navigateur, pas par un en-tête).
 */
export async function rafraichirSessionHttp(): Promise<ReponseSession | null> {
  const reponse = await fetch(`${PREFICE_API_V1}/auth/rafraichir/`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!reponse.ok) return null;
  return (await reponse.json()) as ReponseSession;
}

/** POST /auth/deconnexion — révoque la session courante, purge le cookie. */
export async function deconnecterSession(): Promise<void> {
  try {
    await fetch(`${PREFICE_API_V1}/auth/deconnexion/`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Hors ligne : la session locale sera effacée quand même ; le cookie
    // sera révoqué à son prochain usage (jeton tournant côté serveur).
  }
}

/** POST /auth/demande-reinitialisation (Q-23) — réponse toujours neutre. */
export async function demanderReinitialisation(telephone: string): Promise<string> {
  const { data, error } = await apiClient.POST('/api/v1/auth/demande-reinitialisation/', {
    body: { telephone },
  });
  if (!data) throw erreurDepuisReponse(error, { telephone });
  return (data as { message: string }).message;
}

// --- Profil « moi » ---------------------------------------------------------

/** GET /utilisateurs/moi — profil complet de l'utilisateur connecté. */
export async function obtenirMoi(): Promise<Utilisateur> {
  const { data, error } = await apiClient.GET('/api/v1/utilisateurs/moi/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as Utilisateur;
}

/** PATCH /utilisateurs/moi — nom, email, région, téléphone (hypothèse Q-33). */
export async function modifierMoi(donnees: ModificationMoiDonnees): Promise<Utilisateur> {
  const { data, error } = await apiClient.PATCH('/api/v1/utilisateurs/moi/', {
    body: donnees,
  });
  if (!data) throw erreurDepuisReponse(error, donnees);
  return data as Utilisateur;
}

/** PUT /utilisateurs/moi/mot-de-passe — change le mot de passe (et remet le drapeau). */
export async function changerMotDePasse(donnees: MotDePasseDonnees): Promise<Utilisateur> {
  const { data, error } = await apiClient.PUT('/api/v1/utilisateurs/moi/mot-de-passe/', {
    body: donnees,
  });
  if (!data) throw erreurDepuisReponse(error, { ...donnees, mot_de_passe_actuel: '***' });
  return data as Utilisateur;
}

// --- Adresses ---------------------------------------------------------------

/** GET /utilisateurs/moi/adresses — liste des adresses du compte. */
export async function listerAdresses(): Promise<Adresse[]> {
  const { data, error } = await apiClient.GET('/api/v1/utilisateurs/moi/adresses/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as Adresse[];
}

/** POST /utilisateurs/moi/adresses — ajout (position GeoJSON Point). */
export async function creerAdresse(donnees: AdresseCreationDonnees): Promise<Adresse> {
  const { data, error } = await apiClient.POST('/api/v1/utilisateurs/moi/adresses/', {
    body: donnees,
  });
  if (!data) throw erreurDepuisReponse(error, donnees);
  return data as Adresse;
}

/** PATCH /utilisateurs/moi/adresses/{id} — modification partielle. */
export async function modifierAdresse(
  id: string,
  donnees: AdresseModificationDonnees
): Promise<Adresse> {
  const { data, error } = await apiClient.PATCH('/api/v1/utilisateurs/moi/adresses/{id}/', {
    params: { path: { id } },
    body: donnees,
  });
  if (!data) throw erreurDepuisReponse(error, donnees);
  return data as Adresse;
}

/** DELETE /utilisateurs/moi/adresses/{id} — suppression. */
export async function supprimerAdresse(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/utilisateurs/moi/adresses/{id}/', {
    params: { path: { id } },
  });
  // 204 : pas de corps ; `error` est undefined en succès typé.
  if (error) throw new ErreurApi('erreur_serveur', 'Suppression impossible.', 500);
}

// --- Interne ----------------------------------------------------------------

/**
 * En cas d'échec, le middleware lève déjà une ErreurApi ; ce chemin ne
 * couvre que les rejets obtenus via `.error` typé (corps non conforme).
 * Exporté : tous les services de la couche API partagent cette lecture du
 * contrat d'erreur `{"erreur": {code, message, …}}` (conventions §4).
 */
export function erreurDepuisReponse(error: unknown, _donnees: unknown): ErreurApi {
  if (error instanceof ErreurApi) return error;
  const brute = error as { erreur?: { code?: string; message?: string } } | undefined;
  if (brute && brute.erreur) {
    return new ErreurApi(
      brute.erreur.code || 'erreur_inconnue',
      brute.erreur.message || 'Erreur inattendue.',
      400
    );
  }
  return new ErreurApi('erreur_inattendue', 'Une erreur inattendue est survenue.', 0);
}
