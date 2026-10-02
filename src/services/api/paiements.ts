import { apiClient, ErreurApi } from './client';
import { normaliserErreur } from './auth';
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
