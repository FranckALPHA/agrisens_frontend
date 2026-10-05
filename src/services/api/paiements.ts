import { apiClient, ErreurApi, PREFICE_API_V1 } from './client';
import { normaliserErreur } from './auth';
import { useSessionStore } from '@/stores/session';
import type { components } from './schema';

export type PaiementApi = components['schemas']['Paiement'];
export type OperateurPaiement = 'mtn_momo' | 'orange_money';

export const OPERATEURS_PAIEMENT = [
  { valeur: 'mtn_momo', libelle: 'MTN Mobile Money' },
  { valeur: 'orange_money', libelle: 'Orange Money' },
] as const;

/** POST /commandes/{id}/paiements — initie le paiement (clé d'idempotence). */
export async function initierPaiement(
  commandeId: string,
  donnees: { operateur: OperateurPaiement; telephone?: string },
  cleIdempotence: string
): Promise<PaiementApi & { url_paiement: string; rejoue: boolean }> {
  const { data, error } = await apiClient.POST('/api/v1/commandes/{identifiant}/paiements/', {
    params: { path: { identifiant: commandeId } },
    body: donnees,
    headers: { 'Idempotency-Key': cleIdempotence },
  });
  if (!data) throw normaliserErreur(error);
  return data as PaiementApi & { url_paiement: string; rejoue: boolean };
}

/** GET /paiements/{id} — statut réel côté backend (jamais supposé). */
export async function obtenirPaiement(paiementId: string): Promise<PaiementApi> {
  const { data, error } = await apiClient.GET('/api/v1/paiements/{identifiant}/', {
    params: { path: { identifiant: paiementId } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /paiements/par-reference/{ref} — callback NotchPay (reference PAY-NNNN-NNNNNN). */
export async function obtenirPaiementParReference(reference: string): Promise<PaiementApi> {
  const token = useSessionStore.getState().token;
  const reponse = await fetch(`${PREFICE_API_V1}/paiements/par-reference/${reference}/`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({}));
    throw new ErreurApi(
      (corps as { code?: string }).code ?? 'ressource_introuvable',
      (corps as { message?: string }).message ?? 'Paiement introuvable.',
      reponse.status
    );
  }
  return (await reponse.json()) as PaiementApi;
}

/** POST /paiements/{id}/verifier/ — force la vérification gateway (webhook indisponible). */
export async function verifierPaiementGateway(paiementId: string): Promise<PaiementApi> {
  const token = useSessionStore.getState().token;
  const reponse = await fetch(`${PREFICE_API_V1}/paiements/${paiementId}/verifier/`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  });
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({}));
    throw new ErreurApi(
      (corps as { code?: string }).code ?? 'erreur_serveur',
      (corps as { message?: string }).message ?? 'Vérification impossible.',
      reponse.status
    );
  }
  return (await reponse.json()) as PaiementApi;
}

export function messageErreurPaiement(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    if (erreur.code === 'transition_invalide')
      return 'Cette commande ne peut plus être payée dans son état actuel.';
    if (erreur.code === 'operateur_inconnu') return 'Choisissez MTN ou Orange Money.';
    if (erreur.code === 'telephone_invalide')
      return 'Numéro invalide (format E.164, ex. +2376XXXXXXXX).';
    if (erreur.code === 'cle_idempotence_differente')
      return 'Un paiement différent est déjà lié à cette tentative.';
    if (erreur.code === 'erreur_fournisseur' || erreur.code === 'paiement_refuse')
      return 'Le service de paiement est indisponible. Réessayez dans un moment.';
    if (erreur.code === 'ressource_introuvable')
      return 'Paiement introuvable ou accès non autorisé.';
    return erreur.message;
  }
  return 'Impossible de joindre AgriSens. Vérifiez votre connexion puis réessayez.';
}

/** Clé d'idempotence unique par tentative de paiement (anti double-clic). */
export function nouvelleCleIdempotence(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e12).toString(36)}`;
}
