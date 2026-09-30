/**
 * Configuration de TanStack Query pour AgriSens.
 * Règles : nouvelles tentatives raisonnables (2 max pour erreurs réseau / 5xx),
 * JAMAIS de nouvelle tentative pour les erreurs 4xx (client).
 */

import { QueryClient } from '@tanstack/react-query';
import { ErreurApi } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes par défaut
      gcTime: 1000 * 60 * 15, // 15 minutes en mémoire
      refetchOnWindowFocus: false, // Économie de données pour connexion faible
      retry: (failureCount, error) => {
        // Pas de nouvelle tentative pour les erreurs 4xx (droits, introuvable, validation...)
        if (error instanceof ErreurApi && error.statutHttp >= 400 && error.statutHttp < 500) {
          return false;
        }
        // Maximum 2 tentatives pour les erreurs 5xx ou réseau
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false, // Pas de réessai automatique sur les mutations (éviter les doublons de commandes)
    },
  },
});
