/**
 * Persistance TanStack Query dans IndexedDB (F-15, SPEC-12 §2).
 *
 * - Cache des requêtes relu au démarrage (écrans déjà consultés).
 * - Données séparées par utilisateur (clé IndexedDB préfixée par l'ID).
 * - Effacées à la déconnexion (aucune trace de données privées).
 */

import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import { queryClient } from '@/services/api/queryClient';

const CLE_PREFIX = 'agrisens:query-cache';

function clePerUser(userId: string): string {
  return `${CLE_PREFIX}:${userId}`;
}

/** Persister async basé sur IndexedDB (idb-keyval). */
function creerPersister(userId: string) {
  return createAsyncStoragePersister({
    storage: {
      getItem: async (key: string) => (await get(key)) ?? null,
      setItem: async (key: string, value: string) => {
        await set(key, value);
      },
      removeItem: async (key: string) => {
        await del(key);
      },
    },
    key: clePerUser(userId),
    throttleTime: 2000,
  });
}

let annulationPersistance: (() => void) | null = null;

/**
 * Active la persistance pour l'utilisateur connecté.
 * Rappelé à chaque changement de session.
 */
export function demarrerPersistance(userId: string): void {
  // Stopper une persistance antérieure si elle existe.
  arreterPersistance();

  // Environnement sans IndexedDB (SSR, tests jsdom) : rien à persister.
  if (typeof indexedDB === 'undefined') return;

  const persister = creerPersister(userId);
  const [annuler, restauration] = persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 24 h
    dehydrateOptions: {
      // Ne pas persister les mutations ni les données très fraîches.
      shouldDehydrateQuery: (query) => query.state.status === 'success',
    },
  });
  annulationPersistance = annuler;
  // L'échec de restauration (quota, stockage privé) ne doit jamais casser la session.
  // Après hydratation, on marque tout caduc SANS déclencher de re-fetch immédiat
  // (`refetchType: 'none'`) : les écrans affichent le cache puis le réactualisent
  // à leur prochain montage, et les WebSockets temps réel ne sont pas bouclés.
  void Promise.resolve(restauration)
    .then(() => queryClient.invalidateQueries({ refetchType: 'none' }))
    .catch(() => undefined);
}

/** Désactive la persistance et purge le cache IndexedDB de l'utilisateur. */
export function arreterPersistance(): void {
  if (annulationPersistance) {
    annulationPersistance();
    annulationPersistance = null;
  }
}

/** Purge totale : appelée à la déconnexion. */
export async function purgerCache(userId: string): Promise<void> {
  arreterPersistance();
  if (typeof indexedDB !== 'undefined') {
    await del(clePerUser(userId));
  }
  queryClient.clear();
}

/** Vérifie si un cache persisté existe pour l'utilisateur (hygiène post-logout). */
export async function existerCache(userId: string): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  const valeur = await get(clePerUser(userId));
  return valeur !== undefined && valeur !== null;
}
