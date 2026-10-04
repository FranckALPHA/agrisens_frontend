/**
 * Service API de l'accompagnement agronomique (F-11, SPEC-07).
 * Toutes les fonctions délèguent au backend ; la machine à états vit dans
 * `apps/accompagnements/services.py` (conventions §3, seul point de vérité).
 */

import { apiClient, ErreurApi } from './client';
import { normaliserErreur } from './auth';
import type { components } from './schema';

export type AccompagnementApi = components['schemas']['Accompagnement'];
export type AccompagnementDetailApi = components['schemas']['AccompagnementDetail'];
export type ListeAccompagnementsApi = components['schemas']['ListeAccompagnements'];
export type AffectationIngenieurApi = components['schemas']['AffectationIngenieur'];
export type DevisReponseApi = components['schemas']['DevisReponse'];
export type ModaliteApi = components['schemas']['ModaliteEnum'];
export type StatutAccompagnementApi = components['schemas']['StatutAccompagnementEnum'];
export type AbsentRdvApi = components['schemas']['AbsentEnum'];
export type OperateurApi = components['schemas']['OperateurPaiementEnum'];

export interface DevisEnvoi {
  exploitation_id: string;
  ingenieur_id: string;
  modalite: ModaliteApi;
}

export interface CreationEnvoi {
  exploitation_id: string;
  ingenieur_id: string;
  modalite: ModaliteApi;
  motif: string;
  description?: string | null;
}

export interface PlanifierEnvoi {
  date_debut: string;
  date_fin: string;
  lieu_rdv?: { type: string; coordinates: unknown[] } | null;
  lieu_rdv_texte?: string | null;
  lien_visio?: string | null;
}

export interface ConfirmationApi {
  paiement_id: string;
  reference_interne: string;
  url_paiement: string;
  montant_fcfa: number;
  rejoue: boolean;
}

/** POST /accompagnements/devis — chiffre sans rien créer (docs/07 §15.6). */
export async function obtenirDevis(envoi: DevisEnvoi): Promise<DevisReponseApi> {
  const { data, error } = await apiClient.POST('/api/v1/accompagnements/devis/', {
    body: envoi,
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /accompagnements — crée la demande en `demandee`. */
export async function creerAccompagnement(envoi: CreationEnvoi): Promise<AccompagnementApi> {
  const { data, error } = await apiClient.POST('/api/v1/accompagnements/', { body: envoi });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /accompagnements — les siens (agriculteur) ou affectés (ingénieur). */
export async function listerAccompagnements(): Promise<ListeAccompagnementsApi> {
  const { data, error } = await apiClient.GET('/api/v1/accompagnements/');
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /accompagnements/demandes — demandes reçues par l'ingénieur connecté. */
export async function listerDemandes(): Promise<AccompagnementApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/accompagnements/demandes/');
  if (!data) throw normaliserErreur(error);
  return data as unknown as AccompagnementApi[];
}

/** GET /accompagnements/{id} — détail + historique + affectations. */
export async function obtenirAccompagnement(identifiant: string): Promise<AccompagnementDetailApi> {
  const { data, error } = await apiClient.GET('/api/v1/accompagnements/{identifiant}/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /{id}/accepter — ingénieur affecté. */
export async function accepterAccompagnement(identifiant: string): Promise<AccompagnementApi> {
  const { data, error } = await apiClient.POST('/api/v1/accompagnements/{identifiant}/accepter/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /{id}/refuser — motif obligatoire côté service (`motif_obligatoire`). */
export async function refuserAccompagnement(
  identifiant: string,
  motif: string
): Promise<AccompagnementApi> {
  const { data, error } = await apiClient.POST('/api/v1/accompagnements/{identifiant}/refuser/', {
    params: { path: { identifiant } },
    body: { motif },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /{id}/planifier — fige le montant, 409 en cas de conflit (`conflit_creneau`). */
export async function planifierAccompagnement(
  identifiant: string,
  envoi: PlanifierEnvoi
): Promise<AccompagnementApi> {
  const { data, error } = await apiClient.POST('/api/v1/accompagnements/{identifiant}/planifier/', {
    params: { path: { identifiant } },
    body: envoi,
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /{id}/confirmer — déclenche le paiement NotchPay (Q-05). */
export async function confirmerAccompagnement(
  identifiant: string,
  operateur: OperateurApi,
  telephone?: string,
  cleIdempotence?: string
): Promise<ConfirmationApi> {
  const entete = cleIdempotence ? { 'Idempotency-Key': cleIdempotence } : undefined;
  const { data, error } = await apiClient.POST('/api/v1/accompagnements/{identifiant}/confirmer/', {
    params: { path: { identifiant }, header: entete as never },
    body: { operateur, ...(telephone ? { telephone } : {}) } as never,
  });
  if (!data) throw normaliserErreur(error);
  return data as unknown as ConfirmationApi;
}

/** POST /{id}/terminer — observation obligatoire (07 §15.6). */
export async function terminerAccompagnement(
  identifiant: string,
  observation: string
): Promise<AccompagnementApi> {
  const { data, error } = await apiClient.POST('/api/v1/accompagnements/{identifiant}/terminer/', {
    params: { path: { identifiant } },
    body: { observation },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /{id}/marquer-manque — Q-30 : ingénieur absent → remboursement auto. */
export async function marquerManque(
  identifiant: string,
  absent: AbsentRdvApi
): Promise<AccompagnementApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/accompagnements/{identifiant}/marquer-manque/',
    { params: { path: { identifiant } }, body: { absent } }
  );
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /{id}/changer-ingenieur — Q-29, historisé ; admin seul après paiement. */
export async function changerIngenieur(
  identifiant: string,
  ingenieurId: string
): Promise<AccompagnementApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/accompagnements/{identifiant}/changer-ingenieur/',
    { params: { path: { identifiant } }, body: { ingenieur_id: ingenieurId } }
  );
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /{id}/annuler — agriculteur, avant paiement. */
export async function annulerAccompagnement(identifiant: string): Promise<AccompagnementApi> {
  const { data, error } = await apiClient.POST('/api/v1/accompagnements/{identifiant}/annuler/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** Traduit les codes d'erreur spécifiques de l'accompagnement en message français. */
export function messageErreurAccompagnement(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    switch (erreur.code) {
      case 'distance_max_depasee':
        return "L'ingénieur est trop loin pour un rendez-vous en présentiel ; choisissez « en ligne ».";
      case 'conflit_creneau':
        return 'Ce créneau chevauche un autre rendez-vous déjà planifié pour cet ingénieur.';
      case 'ingenieur_indisponible':
        return "Cet ingénieur n'est pas validé ou n'est pas disponible actuellement.";
      case 'motif_obligatoire':
        return 'Le motif est obligatoire.';
      case 'observation_obligatoire':
        return "Le compte rendu est obligatoire pour clôturer l'accompagnement.";
      case 'changement_apres_paiement':
        return "Après paiement, seul l'administrateur peut changer l'ingénieur.";
      case 'lien_requis':
        return 'Un lien de visioconférence est requis pour un rendez-vous en ligne.';
      case 'lieu_requis':
        return 'Une adresse ou localisation est requise pour un rendez-vous présentiel.';
      case 'date_passee':
        return 'Le rendez-vous doit être fixé dans le futur.';
      case 'duree_invalid':
        return 'La date de fin doit suivre la date de début.';
      case 'transition_invalide':
        return 'Cette action n’est plus possible pour cet accompagnement.';
      case 'ressource_introuvable':
        return 'Accompagnement introuvable ou accès non autorisé.';
      default:
        return erreur.message;
    }
  }
  return 'Impossible de joindre AgriSens. Vérifiez votre connexion puis réessayez.';
}
