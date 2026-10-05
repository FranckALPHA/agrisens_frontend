/**
 * Service API de la génération IA (F-12, SPEC-08).
 * Toutes les fonctions délèguent au backend ; la logique (quota, idempotence,
 * payload anti-données-personnelles) vit dans `apps/plannings/services.py`
 * (conventions §3, seul point de vérité). Aucun tarif/quota n'est codé ici.
 */

import { apiClient, ErreurApi } from './client';
import { normaliserErreur } from './auth';
import type { components } from './schema';

export type GenerationIADetailApi = components['schemas']['GenerationIADetail'];
export type GenerationIAListApi = components['schemas']['GenerationIAList'];
export type ListeGenerationsIAApi = components['schemas']['ListeGenerationsIA'];
export type CorrectionIAApi = components['schemas']['CorrectionIA'];
export type PlanningCreationApi = components['schemas']['PlanningCreationRequest'];
export type RecommandationCreationApi = components['schemas']['RecommandationCreationRequest'];
export type CorrectionCreationApi = components['schemas']['CorrectionCreationRequest'];
export type TypeGenerationApi = components['schemas']['TypeGenerationEnum'];
export type StatutGenerationApi = components['schemas']['StatutGenerationEnum'];

/** Compteurs mensuel / limite par type (GET /ia/quota, réponse non typée côté schéma). */
export interface CompteQuotaIA {
  consomme: number;
  limite: number;
}

export interface QuotaIA {
  mois: string;
  date_reinitialisation: string;
  planning: CompteQuotaIA;
  recommandation: CompteQuotaIA;
}

export interface OptionsGeneration {
  /** En-tête `Idempotency-Key` (rejeu sûr côté service). */
  cleIdempotence?: string;
  /** Mode du fournisseur factice, local/test uniquement (`?test_simule=`). */
  testSimule?: 'normal' | 'invalide' | 'echec' | 'timeout';
  /** Signal d'annulation côté client (AbortController). */
  signal?: AbortSignal;
}

/**
 * Shapes validés côté backend par les schémas Pydantic (`apps/plannings/schemas.py`).
 * `reponse_originale` arrive typé `unknown` (JSONField) ; on le retype ici à la lecture.
 */
export interface EtapePlanning {
  date_debut: string;
  date_fin: string;
  activite: string;
  details?: string;
  intrants?: string[];
}

export interface PlanningReponse {
  culture: string;
  resume?: string;
  avertissement: string;
  etapes: EtapePlanning[];
  risques?: string[];
  conseils?: string[];
}

export interface RecommandationItem {
  titre: string;
  detail: string;
  priorite: 'basse' | 'moyenne' | 'haute';
}

export interface RecommandationReponse {
  sujet: string;
  avertissement: string;
  recommandations: RecommandationItem[];
}

const EST_PLANNING = (r: PlanningReponse | RecommandationReponse): r is PlanningReponse =>
  Array.isArray((r as PlanningReponse).etapes);

/** Retype `reponse_originale` (PlanningResult) ; null si forme inattendue. */
export function lireReponsePlanning(reponse: unknown): PlanningReponse | null {
  if (reponse && typeof reponse === 'object' && EST_PLANNING(reponse as PlanningReponse)) {
    return reponse as PlanningReponse;
  }
  return null;
}

/** Retype `reponse_originale` (RecommandationResult) ; null si forme inattendue. */
export function lireReponseRecommandation(reponse: unknown): RecommandationReponse | null {
  if (
    reponse &&
    typeof reponse === 'object' &&
    Array.isArray((reponse as RecommandationReponse).recommandations)
  ) {
    return reponse as RecommandationReponse;
  }
  return null;
}

/** GET /ia/quota — quota mensuel de l'utilisateur connecté (agriculteur). */
export async function obtenirQuota(): Promise<QuotaIA> {
  // Le corps n'est pas typé dans OpenAPI (objet libre) ; on passe par
  // `apiClient` pour bénéficier du middleware d'authentification
  // (Bearer injecté depuis le store mémoire), sinon 401 systématique.
  const { data, error } = await apiClient.GET('/api/v1/ia/quota/');
  if (error || !data) {
    throw normaliserErreur(error ?? new ErreurApi('erreur_serveur', 'Quota indisponible', 500));
  }
  return data as unknown as QuotaIA;
}

/** POST /exploitations/{id}/plannings — génère un planning cultural. */
export async function genererPlanning(
  exploitationId: string,
  corps: PlanningCreationApi,
  options: OptionsGeneration = {}
): Promise<GenerationIADetailApi> {
  const { data, error } = await apiClient.POST('/api/v1/exploitations/{identifiant}/plannings/', {
    params: {
      path: { identifiant: exploitationId },
      query: options.testSimule ? { test_simule: options.testSimule } : undefined,
      header: options.cleIdempotence ? { 'Idempotency-Key': options.cleIdempotence } : undefined,
    } as never,
    body: corps,
    signal: options.signal,
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /exploitations/{id}/plannings — historique paginé des générations. */
export async function listerPlannings(
  exploitationId: string,
  page = 1,
  taille = 20
): Promise<ListeGenerationsIAApi> {
  const { data, error } = await apiClient.GET('/api/v1/exploitations/{identifiant}/plannings/', {
    params: { path: { identifiant: exploitationId }, query: { page, taille } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /exploitations/{id}/recommandations — recommandation agronomique (quota séparé). */
export async function genererRecommandation(
  exploitationId: string,
  corps: RecommandationCreationApi,
  options: OptionsGeneration = {}
): Promise<GenerationIADetailApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/exploitations/{identifiant}/recommandations/',
    {
      params: {
        path: { identifiant: exploitationId },
        query: options.testSimule ? { test_simule: options.testSimule } : undefined,
        header: options.cleIdempotence ? { 'Idempotency-Key': options.cleIdempotence } : undefined,
      } as never,
      body: corps,
      signal: options.signal,
    }
  );
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /generations-ia/{id} — détail (propriétaire, ingénieur affecté, admin). */
export async function obtenirGeneration(identifiant: string): Promise<GenerationIADetailApi> {
  const { data, error } = await apiClient.GET('/api/v1/generations-ia/{identifiant}/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /generations-ia/{id}/corrections — correction ingénieur (ne mute jamais l'original). */
export async function creerCorrection(
  identifiant: string,
  corps: CorrectionCreationApi
): Promise<CorrectionIAApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/generations-ia/{identifiant}/corrections/',
    { params: { path: { identifiant } }, body: corps }
  );
  if (!data) throw normaliserErreur(error);
  return data;
}

/** Traduit les codes d'erreur spécifiques de la génération IA en message français. */
export function messageErreurPlannings(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    switch (erreur.code) {
      case 'quota_atteint': {
        const limite = erreur.details?.limite;
        const reinit = erreur.details?.date_reinitialisation;
        const supplement = reinit ? ` Nouvelle remise à zéro le ${String(reinit)}.` : '';
        return (
          `Vous avez atteint la limite de ${String(limite ?? '')} générations ce mois-ci.` +
          supplement
        );
      }
      case 'reponse_invalide':
        return "L'IA a renvoyé une réponse inexploitable. Aucune génération n'a été décomptée.";
      case 'limite_fournisseur':
        return "Le service d'IA est temporairement indisponible. Réessayez dans un instant.";
      case 'delai_depasse':
        return "Le calcul de l'IA a dépassé le délai maximum. Réessayez plus tard.";
      case 'donnees_manquantes':
        return 'Données manquantes pour interroger l’IA (culture, période ou sujet requis).';
      case 'generation_introuvable':
      case 'ressource_introuvable':
        return 'Génération introuvable ou accès non autorisé.';
      case 'offre_indisponible':
        return 'Offre d’abonnement indisponible : contactez l’administrateur.';
      default:
        return erreur.message;
    }
  }
  return 'Impossible de joindre AgriSens. Vérifiez votre connexion puis réessayez.';
}
