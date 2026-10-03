/**
 * Service API des litiges F-09 : remboursements, signalements, évaluations
 * (docs/03-api-endpoints.md SPEC-05/SPEC-10, prompt F-09 frontend).
 *
 * Les règles métier (délai de 48 h, justificatif obligatoire, montant ≤
 * paiement, exécution manuelle Q-26) vivent côté service backend ; ici on
 * n'appelle les routes et on traduit les codes d'erreur en messages.
 */

import { apiClient, ErreurApi } from './client';
import { normaliserErreur } from './auth';
import type { components } from './schema';

export type RemboursementApi = components['schemas']['Remboursement'];
export type SignalementApi = components['schemas']['Signalement'];
export type EvaluationApi = components['schemas']['Evaluation'];
export type MotifRemboursementApi = components['schemas']['MotifRemboursementEnum'];
export type CibleSignalementApi = components['schemas']['CibleSignalementEnum'];
export type StatutSignalementTraitementApi = components['schemas']['TraiterSignalementStatutEnum'];

/** Libellés français des motifs de remboursement (07 §15.3). */
export const MOTIFS_REMBOURSEMENT: ReadonlyArray<{
  valeur: MotifRemboursementApi;
  libelle: string;
}> = [
  { valeur: 'produit_endommage', libelle: 'Produit endommagé' },
  { valeur: 'produit_incorrect', libelle: 'Produit incorrect (pas celui commandé)' },
  { valeur: 'non_recu', libelle: 'Commande non reçue' },
  { valeur: 'autre', libelle: 'Autre motif' },
];

/** Motifs pour lesquels une photo/justificatif est obligatoire (07 §15.3). */
export const MOTIFS_JUSTIFICATIF_REQUIS: ReadonlySet<MotifRemboursementApi> = new Set([
  'produit_endommage',
  'produit_incorrect',
  'non_recu',
]);

/** Cibles possibles d'un signalement (SPEC-10) ; messages réservé F-13. */
export const CIBLES_SIGNALEMENT: ReadonlyArray<{ valeur: CibleSignalementApi; libelle: string }> = [
  { valeur: 'utilisateur', libelle: 'Un utilisateur' },
  { valeur: 'produit', libelle: 'Un produit' },
  { valeur: 'commande', libelle: 'Une commande' },
  { valeur: 'livraison', libelle: 'Une livraison' },
  { valeur: 'accompagnement', libelle: 'Un accompagnement' },
];

/** Libellés des motifs de signalement (02 §2.9). */
export const MOTIFS_SIGNALEMENT: ReadonlyArray<{ valeur: string; libelle: string }> = [
  { valeur: 'contenu_inapproprie', libelle: 'Contenu inapproprié' },
  { valeur: 'arnaque', libelle: 'Arnaque / fraude' },
  { valeur: 'photo_trompeuse', libelle: 'Photo trompeuse' },
  { valeur: 'comportement', libelle: 'Comportement incorrect' },
  { valeur: 'autre', libelle: 'Autre' },
];

/** POST /remboursements — demande de l'acheteur (délai + justificatif vérifiés par l'API). */
export async function demanderRemboursement(donnees: {
  commande_id: string;
  motif: MotifRemboursementApi;
  montant_demande_fcfa: number;
  justificatifs?: string[];
  signalement_id?: string | null;
}): Promise<RemboursementApi> {
  const { data, error } = await apiClient.POST('/api/v1/remboursements/', {
    body: {
      commande_id: donnees.commande_id,
      motif: donnees.motif,
      montant_demande_fcfa: donnees.montant_demande_fcfa,
      justificatifs: donnees.justificatifs ?? [],
      ...(donnees.signalement_id ? { signalement_id: donnees.signalement_id } : {}),
    },
  });
  if (!data) throw normaliserErreur(error);
  return data as RemboursementApi;
}

/** GET /remboursements/mes-demandes — suivi du demandeur. */
export async function listerMesRemboursements(): Promise<RemboursementApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/remboursements/mes-demandes/');
  if (!data) throw normaliserErreur(error);
  return data as RemboursementApi[];
}

/** GET /admin/remboursements — file de traitement, filtrable par statut. */
export async function listerRemboursementsAdmin(statut?: string): Promise<RemboursementApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/admin/remboursements/', {
    params: { query: statut ? { statut } : {} },
  });
  if (!data) throw normaliserErreur(error);
  return data as RemboursementApi[];
}

/** POST /admin/remboursements/{id}/examiner — `demande → en_examen`. */
export async function examinerRemboursement(identifiant: string): Promise<RemboursementApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/admin/remboursements/{identifiant}/examiner/',
    { params: { path: { identifiant } } }
  );
  if (!data) throw normaliserErreur(error);
  return data as RemboursementApi;
}

/** POST /admin/remboursements/{id}/approuver — montant total ou partiel. */
export async function approuverRemboursement(
  identifiant: string,
  montantAccordeFcfa: number
): Promise<RemboursementApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/admin/remboursements/{identifiant}/approuver/',
    {
      params: { path: { identifiant } },
      body: { montant_accorde_fcfa: montantAccordeFcfa },
    }
  );
  if (!data) throw normaliserErreur(error);
  return data as RemboursementApi;
}

/** POST /admin/remboursements/{id}/refuser — motif obligatoire (règle service). */
export async function refuserRemboursement(
  identifiant: string,
  motif: string
): Promise<RemboursementApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/admin/remboursements/{identifiant}/refuser/',
    { params: { path: { identifiant } }, body: { motif } }
  );
  if (!data) throw normaliserErreur(error);
  return data as RemboursementApi;
}

/** POST /admin/remboursements/{id}/executer — enregistre la référence du renvoi (Q-26). */
export async function executerRemboursement(
  identifiant: string,
  referenceOperateur: string
): Promise<RemboursementApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/admin/remboursements/{identifiant}/executer/',
    { params: { path: { identifiant } }, body: { reference_operateur: referenceOperateur } }
  );
  if (!data) throw normaliserErreur(error);
  return data as RemboursementApi;
}

/** POST /signalements — cible + motif + description + fichiers (SPEC-10). */
export async function creerSignalement(donnees: {
  cible_type: CibleSignalementApi;
  cible_id: string;
  motif: string;
  description: string;
  fichier_ids?: string[];
}): Promise<SignalementApi> {
  const { data, error } = await apiClient.POST('/api/v1/signalements/', {
    body: {
      cible_type: donnees.cible_type,
      cible_id: donnees.cible_id,
      motif: donnees.motif,
      description: donnees.description,
      fichier_ids: donnees.fichier_ids ?? [],
    },
  });
  if (!data) throw normaliserErreur(error);
  return data as SignalementApi;
}

/** GET /signalements/mes-signalements — suivi par l'auteur. */
export async function listerMesSignalements(): Promise<SignalementApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/signalements/mes-signalements/');
  if (!data) throw normaliserErreur(error);
  return data as SignalementApi[];
}

/** GET /admin/signalements — file des signalements, filtrable par statut. */
export async function listerSignalementsAdmin(statut?: string): Promise<SignalementApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/admin/signalements/', {
    params: { query: statut ? { statut } : {} },
  });
  if (!data) throw normaliserErreur(error);
  return data as SignalementApi[];
}

/** POST /admin/signalements/{id}/traiter — statut + décision (audit). */
export async function traiterSignalement(
  identifiant: string,
  donnees: { statut: StatutSignalementTraitementApi; decision?: string }
): Promise<SignalementApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/admin/signalements/{identifiant}/traiter/',
    {
      params: { path: { identifiant } },
      body: { statut: donnees.statut, decision: donnees.decision ?? '' },
    }
  );
  if (!data) throw normaliserErreur(error);
  return data as SignalementApi;
}

/** POST /commandes/{id}/evaluation — seulement si livrée, une seule fois. */
export async function creerEvaluation(
  commandeId: string,
  donnees: { note_agriculteur: number; note_livreur?: number | null; commentaire?: string | null }
): Promise<EvaluationApi> {
  const { data, error } = await apiClient.POST('/api/v1/commandes/{identifiant}/evaluation/', {
    params: { path: { identifiant: commandeId } },
    body: {
      note_agriculteur: donnees.note_agriculteur,
      note_livreur: donnees.note_livreur ?? null,
      commentaire: donnees.commentaire ?? null,
    },
  });
  if (!data) throw normaliserErreur(error);
  return data as EvaluationApi;
}

/** GET /commandes/{id}/evaluation — l'évaluation de l'acheteur, null si aucune. */
export async function obtenirEvaluation(commandeId: string): Promise<EvaluationApi | null> {
  const { data, error } = await apiClient.GET('/api/v1/commandes/{identifiant}/evaluation/', {
    params: { path: { identifiant: commandeId } },
  });
  if (!data) {
    const erreur = normaliserErreur(error);
    if (erreur instanceof ErreurApi && erreur.code === 'ressource_introuvable') return null;
    throw erreur;
  }
  return data as EvaluationApi;
}

export function messageErreurLitige(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    switch (erreur.code) {
      case 'delai_depasse':
        return 'Le délai de demande de remboursement est dépassé (48 h après la livraison).';
      case 'commande_non_remboursable':
        return 'Cette commande ne peut pas faire l’objet d’un remboursement.';
      case 'remboursement_deja_demande':
        return 'Un remboursement a déjà été demandé pour cette commande.';
      case 'montant_invalide':
        return 'Le montant demandé doit être supérieur à 0 et ne pas dépasser le paiement.';
      case 'montant_accorde_invalide':
        return 'Le montant accordé ne peut pas dépasser le montant payé.';
      case 'justificatif_requis':
        return 'Ce motif exige au moins une photo ou un justificatif.';
      case 'motif_obligatoire':
        return 'Le motif du refus est obligatoire.';
      case 'reference_obligatoire':
        return 'La référence du renvoi est obligatoire pour enregistrer l’exécution.';
      case 'decision_requise':
        return 'Une décision écrite est obligatoire pour clôturer un signalement.';
      case 'commande_non_livree':
        return 'L’évaluation n’est possible qu’après la livraison de la commande.';
      case 'evaluation_deja_faite':
        return 'Vous avez déjà évalué cette commande.';
      case 'livreur_absent':
        return 'Note du livreur impossible : cette commande n’a pas été livrée par un livreur.';
      case 'transition_invalide':
        return 'Cette action n’est plus possible pour ce dossier.';
      case 'ressource_introuvable':
        return 'Dossier introuvable ou accès non autorisé.';
      default:
        return erreur.message;
    }
  }
  return 'Impossible de joindre AgriSens. Vérifiez votre connexion puis réessayez.';
}
