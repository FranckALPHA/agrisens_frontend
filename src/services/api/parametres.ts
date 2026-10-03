/**
 * Service API F-10 — ADM-04 : paramètres plateforme, offres d'abonnement
 * et référentiels (SPEC-11). Écritures réservées au super-admin côté API ;
 * l'admin consulte en lecture seule.
 */

import { apiClient } from './client';
import { erreurDepuisReponse } from './auth';
import type { components } from './schema';

export type ParametreAdminApi = components['schemas']['ParametreAdmin'];
export type ParametreHistoriqueApi = components['schemas']['ParametreHistorique'];
export type OffreAdminApi = components['schemas']['OffreAdmin'];
export type ReferentielAdminApi = components['schemas']['ReferentielAdmin'];

/** GET /admin/parametres — valeur en vigueur, bornes et planifications. */
export async function listerParametresAdmin(): Promise<ParametreAdminApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/admin/parametres/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ParametreAdminApi[];
}

/** POST /admin/parametres/{cle} — nouvelle valeur (sadm, motif obligatoire). */
export async function definirParametre(
  cle: string,
  corps: { valeur: number; date_effet?: string; motif: string }
): Promise<ParametreHistoriqueApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/parametres/{cle}/', {
    params: { path: { cle } },
    body: corps,
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ParametreHistoriqueApi;
}

/** GET /admin/parametres/{cle}/historique — toutes les lignes (sadm). */
export async function historiqueParametre(cle: string): Promise<ParametreHistoriqueApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/admin/parametres/{cle}/historique/', {
    params: { path: { cle } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as unknown as ParametreHistoriqueApi[];
}

/** POST /admin/parametres/{cle}/restaurer — recrée l'avant-dernière valeur. */
export async function restaurerParametre(cle: string): Promise<ParametreHistoriqueApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/parametres/{cle}/restaurer/', {
    params: { path: { cle } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ParametreHistoriqueApi;
}

/** GET /admin/offres — versions en vigueur + historique par code. */
export async function listerOffresAdmin(): Promise<OffreAdminApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/admin/offres/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as OffreAdminApi[];
}

/** POST /admin/offres — nouvelle version d'offre (sadm seul). */
export async function creerVersionOffre(corps: {
  code: string;
  nom: string;
  prix_mensuel_fcfa: number;
  quota_planning_mois: number;
  quota_recommandation_mois: number;
  date_effet?: string;
}): Promise<OffreAdminApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/offres/', {
    body: corps,
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as OffreAdminApi;
}

/** GET /admin/referentiels/{type} — toutes les entrées, actifs et inactifs. */
export async function listerReferentielsAdmin(typeRef: string): Promise<ReferentielAdminApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/admin/referentiels/{type_ref}/', {
    params: { path: { type_ref: typeRef } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as unknown as ReferentielAdminApi[];
}

/** POST /admin/referentiels/{type} — ajout d'un code (sadm, audité). */
export async function ajouterReferentiel(
  typeRef: string,
  corps: { code: string; libelle: string; ordre?: number }
): Promise<ReferentielAdminApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/referentiels/{type_ref}/', {
    params: { path: { type_ref: typeRef } },
    body: { code: corps.code, libelle: corps.libelle, ordre: corps.ordre ?? 0, type: typeRef },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ReferentielAdminApi;
}

/** PUT /admin/referentiels/entrees/{id} — renommage du libellé, code stable. */
export async function renommerReferentiel(
  id: string,
  libelle: string
): Promise<ReferentielAdminApi> {
  const { data, error } = await apiClient.PUT('/api/v1/admin/referentiels/entrees/{id}/', {
    params: { path: { id } },
    body: { libelle },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ReferentielAdminApi;
}

/** POST /admin/referentiels/entrees/{id}/desactiver — jamais de suppression. */
export async function desactiverReferentiel(id: string): Promise<ReferentielAdminApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/admin/referentiels/entrees/{id}/desactiver/',
    { params: { path: { id } } }
  );
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ReferentielAdminApi;
}

/** Libellés français des groupes de paramètres (prefixe « groupe.cle »). */
export const LIBELLE_GROUPES: Record<string, string> = {
  commission: 'Commission',
  livraison: 'Livraison',
  deplacement: 'Déplacement',
  consultation: 'Consultation',
  commande: 'Commandes',
  remboursement: 'Remboursements',
  fichiers: 'Fichiers',
  ia: 'Intelligence artificielle',
  paiement: 'Paiement',
};

/** Libellés français des types de référentiels (REFERENTIELS_INITIAUX). */
export const TYPES_REFERENTIELS: { valeur: string; libelle: string }[] = [
  { valeur: 'region', libelle: 'Régions' },
  { valeur: 'categorie_produit', libelle: 'Catégories de produit' },
  { valeur: 'unite', libelle: 'Unités' },
  { valeur: 'type_sol', libelle: 'Types de sol' },
  { valeur: 'specialite', libelle: 'Spécialités d’ingénieur' },
  { valeur: 'culture', libelle: 'Cultures' },
];

/** Formate une valeur de paramètre selon le suffixe conventionnel de sa clé. */
export function formaterValeurParametre(cle: string, valeur: number): string {
  if (cle.endsWith('_pb')) return `${valeur / 100} %`;
  if (cle.endsWith('_fcfa')) return `${valeur.toLocaleString('fr-FR')} FCFA`;
  if (cle.endsWith('_km') || cle.endsWith('_kmh'))
    return `${valeur} ${cle.endsWith('_kmh') ? 'km/h' : 'km'}`;
  if (cle.endsWith('_h')) return `${valeur} h`;
  if (cle.endsWith('_min')) return `${valeur} min`;
  if (cle.endsWith('_s')) return `${valeur} s`;
  return `${valeur.toLocaleString('fr-FR')}`;
}
