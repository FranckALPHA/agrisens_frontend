/**
 * File d'attente hors ligne des messages de chat (F-13, hypothèse Q-46d).
 *
 * Quand le réseau est indisponible, un message est mis en attente dans le
 * dépôt (localStorage en production, mémoire dans les tests). À la reconnexion,
 * `vidanger` renvoie chaque message **une seule fois** grâce à l'idempotence
 * serveur par `id_client` : un doublon ne peut pas être créé, même si la
 * fenêtre est large ou si le renvoi échoue puis réussit.
 */

import type { MessageCreationApi } from './api/conversations';

export interface MessageEnAttente {
  conversationId: string;
  corps: MessageCreationApi;
}

/** Abstraction du stockage pour rendre la file testable sans `window`. */
export interface DepotFile {
  lire: () => MessageEnAttente[];
  ecrire: (items: MessageEnAttente[]) => void;
}

const CLE_STOCKAGE = 'agrisens:file-attente-chat';

/** Dépôt en mémoire (tests, environments sans localStorage). */
export function creerDepotMemoire(): DepotFile {
  let elements: MessageEnAttente[] = [];
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
          return brut ? (JSON.parse(brut) as MessageEnAttente[]) : [];
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
 * Empile un message en préservant l'ordre et en dédupliquant par `id_client`
 * (un même message jamais mis deux fois en attente).
 */
export function empiler(depot: DepotFile, item: MessageEnAttente): void {
  const items = depot.lire();
  if (items.some((existant) => existant.corps.id_client === item.corps.id_client)) {
    return;
  }
  depot.ecrire([...items, item]);
}

/** Renvoie la file courante (ordre d'empilement). */
export function lister(depot: DepotFile): MessageEnAttente[] {
  return depot.lire();
}

/** Vide entièrement la file. */
export function vider(depot: DepotFile): void {
  depot.ecrire([]);
}

/**
 * Renvoie la file, dans l'ordre, via `envoyer`. S'arrête à la première erreur
 * **réseau** (les messages restants gardent leur tour) ; une erreur **métier**
 * définitive (blocage, message vide…) retire le message sans bloquer la suite.
 *
 * @returns le nombre de messages effectivement sortis de la file.
 */
export async function vidanger(
  depot: DepotFile,
  envoyer: (item: MessageEnAttente) => Promise<void>,
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
