/**
 * File d’attente hors ligne des actions sûres (F-13 chat, F-15 notifications).
 *
 * Quand le réseau est indisponible, l'action est mise en attente dans le
 * dépôt (localStorage en production, mémoire dans les tests). À la reconnexion,
 * `vidanger` renvoie chaque élément **une seule fois** grâce à l'idempotence
 * serveur.
 *
 * Actions mises en file : message de chat, marquage notification lue.
 * JAMAIS de commande ni de paiement.
 */

import type { MessageCreationApi } from './api/conversations';

export interface MessageEnAttente {
  conversationId: string;
  corps: MessageCreationApi;
}

/** Action sûre : marquage d'une notification comme lue (F-15). */
export interface NotificationLueEnAttente {
  type: 'notification-lue';
  notificationId: string;
}

/** Type union des éléments en file. */
export type ElementEnAttente = MessageEnAttente | NotificationLueEnAttente;

/** Abstraction du stockage pour rendre la file testable sans `window`. */
export interface DepotFile {
  lire: () => ElementEnAttente[];
  ecrire: (items: ElementEnAttente[]) => void;
}

const CLE_STOCKAGE = 'agrisens:file-attente';

/** Dépôt en mémoire (tests, environments sans localStorage). */
export function creerDepotMemoire(): DepotFile {
  let elements: ElementEnAttente[] = [];
  return {
    lire: () => [...elements],
    ecrire: (items) => {
      elements = [...items];
    },
  };
}

/** Dépôt par défaut : localStorage s'il existe, sinon mémoire. */
export function creerDepot(): DepotFile {
  if (typeof localStorage !== 'undefined') {
    return {
      lire: () => {
        try {
          const brut = localStorage.getItem(CLE_STOCKAGE);
          return brut ? (JSON.parse(brut) as ElementEnAttente[]) : [];
        } catch {
          return [];
        }
      },
      ecrire: (items) => {
        try {
          localStorage.setItem(CLE_STOCKAGE, JSON.stringify(items));
        } catch {
          // quota dépassé ou mode privé : on ignore, le direct HTTP fait foi.
        }
      },
    };
  }
  return creerDepotMemoire();
}

/**
 * Empile une action en préservant l’ordre et en dédupliquant :
 * messages par `id_client`, marquages de lecture par `notificationId`
 * (une même action jamais mise deux fois en attente).
 */
export function empiler(depot: DepotFile, item: ElementEnAttente): void {
  const items = depot.lire();
  if ('corps' in item) {
    if (
      items.some(
        (existant) => 'corps' in existant && existant.corps.id_client === item.corps.id_client
      )
    ) {
      return;
    }
  } else if (
    items.some(
      (existant) =>
        'type' in existant &&
        existant.type === 'notification-lue' &&
        existant.notificationId === item.notificationId
    )
  ) {
    return;
  }
  depot.ecrire([...items, item]);
}

/** Renvoie la file courante (ordre d’empilement). */
export function lister(depot: DepotFile): ElementEnAttente[] {
  return depot.lire();
}

/** Vide entièrement la file. */
export function vider(depot: DepotFile): void {
  depot.ecrire([]);
}

/**
 * Dépôt partagé (singleton) : chat et notifications écrivent dans la même
 * file, vidangée à la reconnexion par le fournisseur de temps réel.
 */
let depotPartageInstance: DepotFile | null = null;
export function depotPartage(): DepotFile {
  if (!depotPartageInstance) {
    depotPartageInstance = creerDepot();
  }
  return depotPartageInstance;
}

/**
 * Renvoie la file, dans l’ordre, via `envoyer`. S’arrête à la première erreur
 * **réseau** (les messages restants gardent leur tour) ; une erreur **métier**
 * définitive (blocage, message vide…) retire l’élément sans bloquer la suite.
 *
 * @returns le nombre d’actions effectivement sorties de la file.
 */
export async function vidanger(
  depot: DepotFile,
  envoyer: (item: ElementEnAttente) => Promise<void>,
  estErreurReseau: (erreur: unknown) => boolean
): Promise<number> {
  const items = depot.lire();
  let index = 0;
  let envoyes = 0;

  while (index < items.length) {
    const item = items[index]!;
    try {
      await envoyer(item);
      envoyes += 1;
      index += 1;
    } catch (erreur) {
      if (estErreurReseau(erreur)) {
        // Le réseau retombe : on conserve ce message et toute la suite.
        break;
      }
      // Erreur métier définitive (blocage, message vide…) : on l'abandonne.
      index += 1;
    }
  }

  // Ce qui reste en file = tout ce qui n'a pas été traité (succès ou abandon).
  depot.ecrire(items.slice(index));
  return envoyes;
}
