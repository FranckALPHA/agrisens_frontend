/**
 * Tests unitaires F-15 — file d'attente des actions sûres et persistance.
 *
 * Couvre la logique pure, sans DOM :
 * - déduplication des marquages de notification par `notificationId` ;
 * - file mixte chat + notification préservant l'ordre ;
 * - vidange qui dispatche selon le type et conserve le fautif sur erreur réseau.
 */
import { describe, it, expect } from 'vitest';
import {
  creerDepotMemoire,
  empiler,
  lister,
  vidanger,
  type ElementEnAttente,
  type MessageEnAttente,
  type NotificationLueEnAttente,
} from '@/services/fileAttente';
import { ErreurApi } from '@/services/api/client';
import { CODE_ERREUR_RESEAU } from '@/services/api/auth';

function message(id: string): MessageEnAttente {
  return { conversationId: 'conv1', corps: { contenu: id, id_client: id } };
}

function lecture(id: string): NotificationLueEnAttente {
  return { type: 'notification-lue', notificationId: id };
}

function estErreurReseau(erreur: unknown): boolean {
  return erreur instanceof ErreurApi && erreur.code === CODE_ERREUR_RESEAU;
}

describe('file d’attente F-15 — notifications', () => {
  it('empiler déduplique les marquages lus par notificationId', () => {
    const depot = creerDepotMemoire();
    empiler(depot, lecture('n1'));
    empiler(depot, lecture('n2'));
    empiler(depot, lecture('n1')); // doublon ignoré
    const ids = lister(depot)
      .filter((i): i is NotificationLueEnAttente => 'type' in i)
      .map((i) => i.notificationId);
    expect(ids).toEqual(['n1', 'n2']);
  });

  it('file mixte garde l’ordre d’empilement et le type de chaque action', () => {
    const depot = creerDepotMemoire();
    empiler(depot, message('a'));
    empiler(depot, lecture('n1'));
    empiler(depot, message('b'));
    const types = lister(depot).map((i) => ('corps' in i ? 'message' : i.type));
    expect(types).toEqual(['message', 'notification-lue', 'message']);
  });

  it('vidanger dispatche selon le type et vide la file', async () => {
    const depot = creerDepotMemoire();
    empiler(depot, message('a'));
    empiler(depot, lecture('n1'));
    const recus: string[] = [];
    const n = await vidanger(
      depot,
      async (item: ElementEnAttente) => {
        recus.push('corps' in item ? `msg:${item.corps.id_client}` : `lu:${item.notificationId}`);
      },
      estErreurReseau
    );
    expect(n).toBe(2);
    expect(recus).toEqual(['msg:a', 'lu:n1']);
    expect(lister(depot)).toHaveLength(0);
  });

  it('sur erreur réseau, conserve le marquage fautif et stoppe la vidange', async () => {
    const depot = creerDepotMemoire();
    empiler(depot, lecture('n1'));
    empiler(depot, lecture('n2'));
    const erreur = new ErreurApi(CODE_ERREUR_RESEAU, 'x', 0);
    const n = await vidanger(
      depot,
      async (item: ElementEnAttente) => {
        if ('notificationId' in item && item.notificationId === 'n2') throw erreur;
      },
      estErreurReseau
    );
    expect(n).toBe(1); // n1 parti, n2 reste
    expect(lister(depot)).toHaveLength(1);
  });
});
