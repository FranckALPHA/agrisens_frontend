/**
 * Service API F-14 — statistiques et tableaux de bord (SPEC-11).
 * `GET /statistiques/mes-ventes` (agriculteur), `mes-livraisons` (livreur),
 * `mes-accompagnements` (ingénieur), `plateforme` (admin / super-admin).
 * Les montants et agrégats viennent toujours de l'API, jamais recalculés ici.
 */

import { apiClient } from './client';
import { erreurDepuisReponse } from './auth';
import type { components } from './schema';

export type MesVentesApi = components['schemas']['MesVentes'];
export type MesLivraisonsApi = components['schemas']['MesLivraisons'];
export type MesAccompagnementsApi = components['schemas']['MesAccompagnements'];
export type PlateformeStatsApi = components['schemas']['Plateforme'];
export type PointSerieApi = components['schemas']['PointSerie'];
export type ProduitPopulaireApi = components['schemas']['ProduitPopulaire'];

/** Filtre de période (dates ISO inclusives) + granularité de la série. */
export interface FiltreStatistique {
  du?: string;
  au?: string;
  granularite?: 'jour' | 'semaine' | 'mois';
}

function requete<T>(data: T | undefined, error: unknown): T {
  if (data === undefined) throw erreurDepuisReponse(error, undefined);
  return data as T;
}

function filtres(filtre?: FiltreStatistique): { du?: string; au?: string; granularite?: string } {
  return {
    ...(filtre?.du ? { du: filtre.du } : {}),
    ...(filtre?.au ? { au: filtre.au } : {}),
    ...(filtre?.granularite ? { granularite: filtre.granularite } : {}),
  };
}

/** GET /statistiques/mes-ventes — CA, commissions, quantités, série (agriculteur). */
export async function obtenirMesVentes(filtre?: FiltreStatistique): Promise<MesVentesApi> {
  const { data, error } = await apiClient.GET('/api/v1/statistiques/mes-ventes/', {
    params: { query: filtres(filtre) },
  });
  return requete(data, error);
}

/** GET /statistiques/mes-livraisons — courses, statuts, frais cumulés (livreur). */
export async function obtenirMesLivraisons(filtre?: FiltreStatistique): Promise<MesLivraisonsApi> {
  const { data, error } = await apiClient.GET('/api/v1/statistiques/mes-livraisons/', {
    params: { query: filtres(filtre) },
  });
  return requete(data, error);
}

/** GET /statistiques/mes-accompagnements — missions, revenu net (ingénieur). */
export async function obtenirMesAccompagnements(
  filtre?: FiltreStatistique
): Promise<MesAccompagnementsApi> {
  const { data, error } = await apiClient.GET('/api/v1/statistiques/mes-accompagnements/', {
    params: { query: filtres(filtre) },
  });
  return requete(data, error);
}

/** GET /statistiques/plateforme — agrégats globaux (admin / super-admin). */
export async function obtenirStatistiquesPlateforme(
  filtre?: FiltreStatistique
): Promise<PlateformeStatsApi> {
  const { data, error } = await apiClient.GET('/api/v1/statistiques/plateforme/', {
    params: { query: filtres(filtre) },
  });
  return requete(data, error);
}

/** Libellé court d'un point de série (« 2026-03 » → « mars 2026 »). */
export function formaterPeriode(periode: string, granularite: 'jour' | 'semaine' | 'mois'): string {
  if (granularite === 'mois') {
    const [annee, mois] = periode.split('-');
    const noms = [
      'janv.',
      'févr.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.',
    ];
    const index = Number(mois) - 1;
    return `${noms[index] ?? mois} ${annee}`;
  }
  return periode;
}
