/**
 * Service API des notifications internes (prompt F-03 frontend point 2,
 * SPEC-10). Livraison par interrogation périodique en V1 : la cloche
 * interroge le compteur toutes les 30 s (le WebSocket arrive en F-13).
 */

import { apiClient } from './client';
import { erreurDepuisReponse } from './auth';
import type { components } from './schema';

export type NotificationApi = components['schemas']['Notification'];
export type TypeNotificationApi = components['schemas']['TypeNotificationEnum'];
export type ListeNotificationsApi = components['schemas']['ListeNotifications'];

/** GET /notifications — liste du destinataire connecté, non lues + catégorie + page. */
export async function listerNotifications(
  nonLues = false,
  opts: { page?: number; taille?: number; type?: TypeNotificationApi | 'toutes' } = {}
): Promise<ListeNotificationsApi> {
  const query: Record<string, string | number | boolean> = {};
  if (nonLues) query['non_lues'] = true;
  if (opts.page && opts.page > 1) query['page'] = opts.page;
  if (opts.taille) query['taille'] = opts.taille;
  if (opts.type && opts.type !== 'toutes') query['type'] = opts.type;
  const { data, error } = await apiClient.GET('/api/v1/notifications/', {
    params: { query: query as never },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as ListeNotificationsApi;
}

/** GET /notifications/compteur — alimente la cloche (polling 30 s). */
export async function obtenirCompteurNotifications(): Promise<number> {
  const { data, error } = await apiClient.GET('/api/v1/notifications/compteur/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return (data as { non_lues: number }).non_lues;
}

/** POST /notifications/{id}/lue — marque une notification comme lue. */
export async function marquerNotificationLue(id: string): Promise<NotificationApi> {
  const { data, error } = await apiClient.POST('/api/v1/notifications/{id}/lue/', {
    params: { path: { id } },
  });
  if (!data) throw erreurDepuisReponse(error, undefined);
  return data as NotificationApi;
}

/** POST /notifications/tout-lire — renvoie le nombre de notifications modifiées. */
export async function toutMarquerLu(): Promise<number> {
  const { data, error } = await apiClient.POST('/api/v1/notifications/tout-lire/');
  if (!data) throw erreurDepuisReponse(error, undefined);
  return (data as { modifiees: number }).modifiees;
}
