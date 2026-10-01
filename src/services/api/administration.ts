/**
 * Service API d'administration des utilisateurs (prompt F-03 frontend
 * point 5 : ADM-01 compteurs et ADM-02 gestion, décision D-13).
 */

import { apiClient } from './client';
import { erreurDepuisReponse } from './auth';
import type { components } from './schema';

export type UtilisateurAdminListeApi = components['schemas']['UtilisateurAdminListe'];
export type UtilisateurAdminDetailApi = components['schemas']['UtilisateurAdminDetail'];
export type ListeUtilisateursAdminApi = components['schemas']['ListeUtilisateursAdmin'];
export type CompteursAdminApi = components['schemas']['CompteursAdmin'];
export type MotDePasseTemporaireApi = components['schemas']['MotDePasseTemporaire'];
export type IngenieurPublicApi = components['schemas']['IngenieurPublic'];

/**
 * Justificatif tel que rendu par JustificatifAdminSerializer (backend) ;
 * le schéma générique le declare `unknown` (dict libre), typé ici localement.
 */
export interface JustificatifAdminApi {
  id: string;
  type: string;
  statut: string;
  fichier_id: string;
  nom_original: string;
  type_mime: string;
  cree_le: string;
}

/** Dossier de candidature (ProfilIngenieurAdminSerializer), null si non ingénieur. */
export interface ProfilIngenieurAdminApi {
  statut_validation: 'en_attente' | 'valide' | 'refuse';
  motif_refus: string | null;
  valide_le: string | null;
  specialites: string[];
  tarif_consultation_fcfa: number | null;
  disponible: boolean;
  justificatifs: JustificatifAdminApi[];
}

/** GET /admin/utilisateurs — recherche (nom ou téléphone) et filtres ADM-02. */
export async function listerUtilisateursAdmin(params?: {
  recherche?: string;
  role?: string;
  statut?: string;
  page?: number;
}): Promise<ListeUtilisateursAdminApi> {
  const { data, error } = await apiClient.GET('/api/v1/admin/utilisateurs/', {
    params: {
      query: {
        ...(params?.recherche ? { recherche: params.recherche } : {}),
        ...(params?.role ? { role: params.role } : {}),
        ...(params?.statut ? { statut: params.statut } : {}),
        ...(params?.page ? { page: params.page } : {}),
      },
    },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ListeUtilisateursAdminApi;
}

/** GET /admin/utilisateurs/{id} — détail complet (téléphone non masqué). */
export async function obtenirUtilisateurAdmin(id: string): Promise<UtilisateurAdminDetailApi> {
  const { data, error } = await apiClient.GET('/api/v1/admin/utilisateurs/{id}/', {
    params: { path: { id } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as UtilisateurAdminDetailApi;
}

/** GET /admin/utilisateurs/compteurs — bandeaux ADM-01. */
export async function obtenirCompteursAdmin(): Promise<CompteursAdminApi> {
  const { data, error } = await apiClient.GET('/api/v1/admin/utilisateurs/compteurs/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as CompteursAdminApi;
}

/** GET /admin/utilisateurs/demandes-reinitialisation — file d'attente Q-23. */
export async function listerDemandesReinitialisation(): Promise<ListeUtilisateursAdminApi> {
  const { data, error } = await apiClient.GET(
    '/api/v1/admin/utilisateurs/demandes-reinitialisation/'
  );
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ListeUtilisateursAdminApi;
}

/** POST /admin/utilisateurs/{id}/suspendre — motif obligatoire ; révoque les sessions. */
export async function suspendreUtilisateur(
  id: string,
  motif: string
): Promise<UtilisateurAdminDetailApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/utilisateurs/{id}/suspendre/', {
    params: { path: { id } },
    body: { motif },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as UtilisateurAdminDetailApi;
}

/** POST /admin/utilisateurs/{id}/reactiver — réactive le compte suspendu. */
export async function reactiverUtilisateur(id: string): Promise<UtilisateurAdminDetailApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/utilisateurs/{id}/reactiver/', {
    params: { path: { id } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as UtilisateurAdminDetailApi;
}

/** POST /admin/utilisateurs/{id}/reinitialiser-mot-de-passe — Q-23, affiché une fois. */
export async function reinitialiserMotDePasse(id: string): Promise<MotDePasseTemporaireApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/admin/utilisateurs/{id}/reinitialiser-mot-de-passe/',
    { params: { path: { id } } }
  );
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as MotDePasseTemporaireApi;
}

/** POST /admin/ingenieurs/{id}/valider — décision D-13, notifie l'ingénieur. */
export async function validerIngenieur(id: string): Promise<IngenieurPublicApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/ingenieurs/{id}/valider/', {
    params: { path: { id } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as IngenieurPublicApi;
}

/** POST /admin/ingenieurs/{id}/refuser — motif obligatoire (422 si vide). */
export async function refuserIngenieur(id: string, motif: string): Promise<IngenieurPublicApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/ingenieurs/{id}/refuser/', {
    params: { path: { id } },
    body: { motif },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as IngenieurPublicApi;
}
