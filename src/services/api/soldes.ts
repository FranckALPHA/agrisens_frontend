/**
 * Service API F-10 — soldes bénéficiaires et reversements (Q-11, SPEC-05).
 * `GET /soldes/moi` (agr/liv/ing), `GET /admin/soldes`, `GET/POST /admin/reversements`.
 */

import { apiClient } from './client';
import { erreurDepuisReponse } from './auth';
import type { components } from './schema';

export type SoldeDetailApi = components['schemas']['SoldeDetail'];
export type SoldeLigneApi = components['schemas']['SoldeLigne'];
export type ReversementApi = components['schemas']['Reversement'];
export type ListeReversementsApi = components['schemas']['ListeReversements'];

/** GET /soldes/moi — décomposition du solde de l'utilisateur connecté. */
export async function obtenirMesSoldes(): Promise<SoldeDetailApi> {
  const { data, error } = await apiClient.GET('/api/v1/soldes/moi/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as SoldeDetailApi;
}

/** GET /admin/soldes — bénéficiaires au solde positif (file de reversement). */
export async function listerSoldesAdmin(): Promise<SoldeLigneApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/admin/soldes/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as unknown as SoldeLigneApi[];
}

/** GET /admin/reversements — historique paginé, filtre par bénéficiaire. */
export async function listerReversements(params?: {
  beneficiaire?: string;
  page?: number;
}): Promise<ListeReversementsApi> {
  const { data, error } = await apiClient.GET('/api/v1/admin/reversements/', {
    params: {
      query: {
        ...(params?.beneficiaire ? { beneficiaire: params.beneficiaire } : {}),
        ...(params?.page ? { page: params.page } : {}),
      },
    },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ListeReversementsApi;
}

/** POST /admin/reversements — montant ≤ solde, référence opérateur obligatoire. */
export async function enregistrerReversement(corps: {
  beneficiaire_id: string;
  montant_fcfa: number;
  operateur: 'mtn_momo' | 'orange_money';
  reference_operateur: string;
  note?: string;
}): Promise<ReversementApi> {
  const { data, error } = await apiClient.POST('/api/v1/admin/reversements/', {
    body: corps,
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ReversementApi;
}
