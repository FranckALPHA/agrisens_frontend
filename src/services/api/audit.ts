/**
 * Service API F-10 — ADM-05 : journal d'audit (liste filtrable + export CSV).
 * Routes réservées au super-admin côté API (docs/03 SPEC-11).
 */

import { ErreurApi, PREFICE_API_V1, apiClient, convertirReponseErreur } from './client';
import { erreurDepuisReponse } from './auth';
import { useSessionStore } from '@/stores/session';
import type { components } from './schema';

export type AuditEntreeApi = components['schemas']['AuditEntree'];
export type ListeAuditApi = components['schemas']['ListeAudit'];

export interface FiltresAudit {
  acteur?: string;
  entiteType?: string;
  action?: string;
  debut?: string;
  fin?: string;
  page?: number;
}

function requeteAudit(params: FiltresAudit) {
  return {
    ...(params.acteur ? { acteur: params.acteur } : {}),
    ...(params.entiteType ? { entite_type: params.entiteType } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.debut ? { debut: params.debut } : {}),
    ...(params.fin ? { fin: params.fin } : {}),
    ...(params.page ? { page: params.page } : {}),
  };
}

/** GET /admin/audit — journal paginé, filtres acteur/entité/action/période. */
export async function listerAudit(params: FiltresAudit = {}): Promise<ListeAuditApi> {
  const { data, error } = await apiClient.GET('/api/v1/admin/audit/', {
    params: { query: requeteAudit(params) },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ListeAuditApi;
}

/**
 * GET /admin/audit/export — CSV complet (mêmes filtres), téléchargé puis
 * restitué comme blob ; l'en-tête d'autorisation est posé à la main comme
 * pour les contenus de fichiers (fetch hors openapi-fetch).
 */
export async function telechargerAuditCsv(params: FiltresAudit = {}): Promise<Blob> {
  const jeton = useSessionStore.getState().token;
  const url = new URL(`${PREFICE_API_V1}/admin/audit/export/`);
  Object.entries(requeteAudit(params)).forEach(([cle, valeur]) =>
    url.searchParams.set(cle, String(valeur))
  );
  const reponse = await fetch(url, {
    credentials: 'include',
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
  });
  if (!reponse.ok) {
    let corps: unknown = null;
    try {
      corps = await reponse.json();
    } catch {
      // réponse d'erreur non JSON
    }
    throw convertirReponseErreur(reponse.status, corps);
  }
  return reponse.blob();
}

/** Déclenche le téléchargement navigateur d'un blob CSV. */
export function declencherTelechargement(blob: Blob, nomFichier: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

/** Types d'entités auditables (constantes des services backend). */
export const TYPES_ENTITE_AUDIT: { valeur: string; libelle: string }[] = [
  { valeur: 'parametre_plateforme', libelle: 'Paramètre plateforme' },
  { valeur: 'offre_abonnement', libelle: 'Offre d’abonnement' },
  { valeur: 'referentiel', libelle: 'Référentiel' },
  { valeur: 'reversement', libelle: 'Reversement' },
  { valeur: 'utilisateur', libelle: 'Utilisateur' },
  { valeur: 'profil_ingenieur', libelle: 'Profil ingénieur' },
  { valeur: 'piece_justificative', libelle: 'Pièce justificative' },
  { valeur: 'commande', libelle: 'Commande' },
  { valeur: 'livraison', libelle: 'Livraison' },
  { valeur: 'remboursement', libelle: 'Remboursement' },
  { valeur: 'signalement', libelle: 'Signalement' },
  { valeur: 'evaluation', libelle: 'Évaluation' },
];

/** Erreur de format attendue pour l'export quand la route refuse (403). */
export function estErreurInterdit(erreur: unknown): boolean {
  return erreur instanceof ErreurApi && erreur.statutHttp === 403;
}
