/**
 * Service API des paramètres publics et des référentiels (SPEC-01,
 * conventions §4) — limites de fichiers, bornes de tarif, spécialités,
 * régions. Les valeurs viennent toujours de l'API, jamais en dur (AGENTS.md).
 */

import { apiClient, convertirReponseErreur, PREFICE_API_V1 } from './client';
import { erreurDepuisReponse } from './auth';
import type { components } from './schema';

export type EntreeReferentielApi = components['schemas']['Referentiel'];

/** Dictionnaire des paramètres publics (clés → valeurs courantes). */
export type ParametresPublics = Record<string, number | string | boolean | null>;

/** GET /parametres/publics — non paginé, réponse dictée par le registre. */
export async function obtenirParametresPublics(): Promise<ParametresPublics> {
  // Réponse documentée comme objet libre : fetch direct typé localement.
  const reponse = await fetch(`${PREFICE_API_V1}/parametres/publics/`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!reponse.ok) {
    let corps: unknown = null;
    try {
      corps = await reponse.clone().json();
    } catch {
      // corps non JSON
    }
    throw convertirReponseErreur(reponse.status, corps);
  }
  return (await reponse.json()) as ParametresPublics;
}

/** GET /referentiels/{type_ref} — specialite, region, unite, etc. */
export async function listerReferentiel(typeRef: string): Promise<EntreeReferentielApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/referentiels/{type_ref}/', {
    params: { path: { type_ref: typeRef } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as EntreeReferentielApi[];
}

/**
 * Extrait [longitude, latitude] d'une géométrie ponctuelle reçue de l'API
 * (les types générés déclarent `coordinates: unknown[]`, imbrication selon
 * le type GeoJSON). Retourne null si la forme est inattendue.
 */
export function lirePointGeoJSON(
  geometrie: { coordinates?: unknown } | null | undefined
): { longitude: number; latitude: number } | null {
  const coordonnees = geometrie?.coordinates;
  if (!Array.isArray(coordonnees)) return null;
  const [longitude, latitude] = coordonnees;
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return null;
  return { longitude, latitude };
}
