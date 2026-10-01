/**
 * Service API des profils professionnels (prompt F-03 frontend points 3-4,
 * SPEC-01 : ingénieurs agronomes et livreurs).
 */

import { apiClient } from './client';
import { erreurDepuisReponse } from './auth';
import type { components } from './schema';

export type IngenieurProfilApi = components['schemas']['IngenieurProfil'];
export type IngenieurProfilModification = components['schemas']['IngenieurProfilRequest'];
export type IngenieurPublicApi = components['schemas']['IngenieurPublic'];
export type ListeIngenieursApi = components['schemas']['ListeIngenieurs'];
export type JustificatifApi = components['schemas']['Justificatif'];
export type TypeJustificatifApi = components['schemas']['TypeJustificatifEnum'];
export type LivreurProfilApi = components['schemas']['LivreurProfil'];
export type DisponibiliteModification = components['schemas']['DisponibiliteLivreurRequest'];
export type StatutValidationApi = components['schemas']['StatutValidationEnum'];

/** Géométrie GeoJSON Point (ordre x=longitude, y=latitude — conventions §5). */
export function pointGeoJSON(
  longitude: number,
  latitude: number
): {
  type: string;
  coordinates: number[];
} {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

// --- Ingénieur ---------------------------------------------------------------

/** GET /ingenieurs/moi/profil — profil complet, accessible dès l'inscription. */
export async function obtenirMonProfilIngenieur(): Promise<IngenieurProfilApi> {
  const { data, error } = await apiClient.GET('/api/v1/ingenieurs/moi/profil/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as IngenieurProfilApi;
}

/** PUT /ingenieurs/moi/profil — spécialités, zone, tarif, biographie… */
export async function modifierMonProfilIngenieur(
  donnees: IngenieurProfilModification
): Promise<IngenieurProfilApi> {
  const { data, error } = await apiClient.PUT('/api/v1/ingenieurs/moi/profil/', {
    body: donnees,
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as IngenieurProfilApi;
}

/** GET /ingenieurs/moi/justificatifs — pièces déposées par l'ingénieur. */
export async function listerMesJustificatifs(): Promise<JustificatifApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/ingenieurs/moi/justificatifs/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as JustificatifApi[];
}

/** POST /ingenieurs/moi/justificatifs — rattache un fichier déjà téléversé. */
export async function deposerJustificatif(
  fichierId: string,
  type: TypeJustificatifApi
): Promise<JustificatifApi> {
  const { data, error } = await apiClient.POST('/api/v1/ingenieurs/moi/justificatifs/', {
    body: { fichier_id: fichierId, type },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as JustificatifApi;
}

/** GET /ingenieurs — ingénieurs validés et disponibles (sans téléphone). */
export async function listerIngenieurs(params?: {
  specialite?: string;
  region?: string;
}): Promise<ListeIngenieursApi> {
  const { data, error } = await apiClient.GET('/api/v1/ingenieurs/', {
    params: {
      query: {
        ...(params?.specialite ? { specialite: params.specialite } : {}),
        ...(params?.region ? { region: params.region } : {}),
      },
    },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ListeIngenieursApi;
}

/** GET /ingenieurs/{id} — profil public d'un ingénieur validé. */
export async function obtenirIngenieur(id: string): Promise<IngenieurPublicApi> {
  const { data, error } = await apiClient.GET('/api/v1/ingenieurs/{id}/', {
    params: { path: { id } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as IngenieurPublicApi;
}

// --- Livreur -----------------------------------------------------------------

/** GET /livreurs/moi/disponibilite — état conservé après rechargement (PW-F03-09). */
export async function obtenirMaDisponibilite(): Promise<LivreurProfilApi> {
  const { data, error } = await apiClient.GET('/api/v1/livreurs/moi/disponibilite/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as LivreurProfilApi;
}

/** PUT /livreurs/moi/disponibilite — se rendre disponible exige une position. */
export async function definirMaDisponibilite(
  donnees: DisponibiliteModification
): Promise<LivreurProfilApi> {
  const { data, error } = await apiClient.PUT('/api/v1/livreurs/moi/disponibilite/', {
    body: donnees,
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as LivreurProfilApi;
}
