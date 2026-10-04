/**
 * Service API du chat temps réel et du blocage (F-13, SPEC-10).
 *
 * Logique métier côté backend uniquement (`apps/conversations/services.py`) ;
 * ici on ne fait que transporter l'enveloppe typée. L'envoi d'un message exige
 * un `id_client` (UUID) idempotent : un renvoi après reconnexion ne crée jamais
 * de doublon. Les fichiers de conversation réutilisent le contexte `chat` (F-03).
 */

import { apiClient, ErreurApi } from './client';
import { normaliserErreur } from './auth';
import { creerSignalement } from './litiges';
import type { components } from './schema';

export type ConversationApi = components['schemas']['Conversation'];
export type MessageApi = components['schemas']['Message'];
export type ListeConversationsApi = components['schemas']['ListeConversations'];
export type ConversationCreationApi = components['schemas']['ConversationCreationRequest'];
export type MessageCreationApi = components['schemas']['MessageCreationRequest'];
export type TypeConversationApi = components['schemas']['TypeConversationEnum'];
export type BlocageApi = components['schemas']['Blocage'];

/**
 * Les champs calculés (`autre_participant`, `dernier_message`) arrivent en
 * `unknown` du schéma (SerializerMethodField) ; on les retype ici d'après le
 * sérialiseur backend (`ParticipantMinimalSerializer`, `MessageSerializer`).
 */
export interface ParticipantMinimalApi {
  id: string;
  nom: string;
  role: string;
}

export interface ConversationVue extends Omit<
  ConversationApi,
  'autre_participant' | 'dernier_message'
> {
  autre_participant: ParticipantMinimalApi | null;
  dernier_message: MessageApi | null;
}

export interface ListeConversationsVue extends Omit<ListeConversationsApi, 'elements'> {
  elements: ConversationVue[];
}

/** Réponse de POST /ws/ticket (dictionnat brut côté vue, typé ici). */
export interface TicketWsApi {
  ticket: string;
  expire_dans: number;
}

/** GET /conversations — liste des conversations de l'appelant + non-lus. */
export async function listerConversations(): Promise<ListeConversationsVue> {
  const { data, error } = await apiClient.GET('/api/v1/conversations/');
  if (!data) throw normaliserErreur(error);
  return data as unknown as ListeConversationsVue;
}

/** GET /conversations/{id} — détail d'une conversation participante (sinon 404). */
export async function obtenirConversation(identifiant: string): Promise<ConversationVue> {
  const { data, error } = await apiClient.GET('/api/v1/conversations/{id}/', {
    params: { path: { id: identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data as unknown as ConversationVue;
}

/** POST /conversations — ouvre ou obtient la conversation d'une relation. */
export async function creerConversation(corps: ConversationCreationApi): Promise<ConversationVue> {
  const { data, error } = await apiClient.POST('/api/v1/conversations/', { body: corps });
  if (!data) throw normaliserErreur(error);
  return data as unknown as ConversationVue;
}

/** GET /conversations/{id}/messages — historique, curseur `avant` (pagination). */
export async function listerMessages(identifiant: string, avant?: string): Promise<MessageApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/conversations/{id}/messages/', {
    params: { path: { id: identifiant }, query: avant ? { avant } : {} },
  });
  if (!data) throw normaliserErreur(error);
  return data as MessageApi[];
}

/**
 * POST /conversations/{id}/messages — envoi idempotent par `id_client`.
 * `signal` permet l'annulation (reconnexion, composant démonté). Le backend
 * renvoie 201 à la création, 200 si le même `id_client` est renvoyé.
 */
export async function envoyerMessage(
  identifiant: string,
  corps: MessageCreationApi,
  signal?: AbortSignal
): Promise<MessageApi> {
  const { data, error } = await apiClient.POST('/api/v1/conversations/{id}/messages/', {
    params: { path: { id: identifiant } },
    body: corps,
    signal,
  });
  if (!data) throw normaliserErreur(error);
  return data as MessageApi;
}

/** POST /conversations/{id}/lu — pointe le dernier message lu (accusé de lecture). */
export async function marquerLu(identifiant: string, dernierMessageLuId: string): Promise<void> {
  const { error } = await apiClient.POST('/api/v1/conversations/{id}/lu/', {
    params: { path: { id: identifiant } },
    body: { dernier_message_lu_id: dernierMessageLuId },
  });
  if (error) throw normaliserErreur(error);
}

/** POST /blocages — bloque un utilisateur (empêche l'envoi dans les deux sens). */
export async function bloquer(utilisateurId: string): Promise<BlocageApi> {
  const { data, error } = await apiClient.POST('/api/v1/blocages/', {
    body: { utilisateur_id: utilisateurId },
  });
  if (!data) throw normaliserErreur(error);
  return data as BlocageApi;
}

/** DELETE /blocages/{utilisateur_id} — débloque ; 404 si aucun blocage actif. */
export async function debloquer(utilisateurId: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/blocages/{utilisateur_id}/', {
    params: { path: { utilisateur_id: utilisateurId } },
  });
  if (error) throw normaliserErreur(error);
}

/**
 * Identifiant client (UUID v4) servant de clé d'idempotence à l'envoi.
 * Repli déterministe quand `crypto.randomUUID` est indisponible (jsdom/tests).
 */
export function genererIdClient(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** POST /ws/ticket — ticket jetable (30 s) pour authentifier le canal WS. */
export async function demanderTicketWs(): Promise<TicketWsApi> {
  const { data, error } = await apiClient.POST('/api/v1/ws/ticket/');
  if (!data) throw normaliserErreur(error);
  const corps = data as unknown as Record<string, unknown>;
  return {
    ticket: String(corps['ticket'] ?? ''),
    expire_dans: Number(corps['expire_dans'] ?? 30),
  };
}

/**
 * Signalement d'un message : réutilise la file admin existante (F-09), cible
 * `message`. Aucune route nouvelle — Mireille traite le dossier inchangé.
 */
export async function signalerMessage(
  cibleId: string,
  motif: string,
  description: string
): Promise<void> {
  await creerSignalement({
    cible_type: 'message',
    cible_id: cibleId,
    motif,
    description,
  });
}

/** Traduit les codes d'erreur propres au chat en message français explicatif. */
export function messageErreurConversations(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    switch (erreur.code) {
      case 'blocage_actif':
        return "Vous ne pouvez pas envoyer de message à cette conversation : l'un des participants a bloqué l'autre.";
      case 'message_vide':
        return 'Un message doit contenir du texte ou une pièce jointe.';
      case 'conversation_introuvable':
        return 'Conversation introuvable, ou vous n’en êtes pas participant.';
      case 'ticket_invalide':
        return 'La connexion temps réel a expiré. Reconnexion en cours…';
      default:
        return erreur.message;
    }
  }
  return 'Impossible de joindre AgriSens. Vérifiez votre connexion puis réessayez.';
}
