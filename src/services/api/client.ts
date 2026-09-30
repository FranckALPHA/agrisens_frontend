/**
 * Client API HTTP typé via openapi-fetch (F-01 point 6).
 * Gère credentials: 'include', le token en mémoire, et la conversion des erreurs.
 */

import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { useSessionStore } from '@/stores/session';
import { MESSAGES } from '@/theme/messages';

export class ErreurApi extends Error {
  readonly code: string;
  readonly statutHttp: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statutHttp: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ErreurApi';
    this.code = code;
    this.statutHttp = statutHttp;
    this.details = details;
  }
}

/**
 * Convertit une réponse d'erreur HTTP ou réseau au format standard AgriSens.
 */
export function convertirReponseErreur(
  statut: number,
  donnees?: unknown,
  messageParDefaut = MESSAGES.erreurInconnue
): ErreurApi {
  if (donnees && typeof donnees === 'object' && 'erreur' in donnees) {
    const err = (
      donnees as { erreur: { code?: string; message?: string; details?: Record<string, unknown> } }
    ).erreur;
    return new ErreurApi(
      err.code || 'erreur_inconnue',
      err.message || messageParDefaut,
      statut,
      err.details
    );
  }

  // Erreur sans corps JSON structuré
  return new ErreurApi(
    statut === 404 ? 'ressource_introuvable' : 'erreur_serveur',
    messageParDefaut,
    statut
  );
}

// Point d'accroche pour rafraîchissement silencieux de token (implémenté en F-02)
let crochetRafraichissementToken: (() => Promise<string | null>) | null = null;

export function definirCrochetRafraichissement(fn: () => Promise<string | null>): void {
  crochetRafraichissementToken = fn;
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    // 1. Délai d'attente maximum par défaut (15 secondes)
    if (!request.signal) {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 15000);
    }

    // 2. Injection du jeton Bearer depuis le store en mémoire
    const token = useSessionStore.getState().token;
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }

    // 3. Forcer JSON par défaut
    if (!request.headers.has('Accept')) {
      request.headers.set('Accept', 'application/json');
    }

    return request;
  },

  async onResponse({ response, request }) {
    // Gestion du 401 pour rafraîchissement de jeton
    if (response.status === 401 && crochetRafraichissementToken) {
      const nouveauToken = await crochetRafraichissementToken();
      if (nouveauToken) {
        const nouvelleRequete = new Request(request, {
          headers: new Headers(request.headers),
        });
        nouvelleRequete.headers.set('Authorization', `Bearer ${nouveauToken}`);
        return fetch(nouvelleRequete);
      }
    }

    // Si erreur HTTP, extraire les données pour lever une ErreurApi
    if (!response.ok) {
      let corps: unknown = null;
      try {
        corps = await response.clone().json();
      } catch {
        // Corps non-JSON (ou vide)
      }
      throw convertirReponseErreur(response.status, corps);
    }

    return response;
  },
};

const urlBrute =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '4173'
    ? 'http://127.0.0.1:8001'
    : 'http://localhost:8000');

// Les routes dans schema.d.ts commencent déjà par /api/v1 (ex: /api/v1/sante).
// On supprime donc tout suffixe /api/v1 pour éviter le dédoublement /api/v1/api/v1/
const baseUrl = urlBrute.replace(/\/api\/v1\/?$/, '');

export const apiClient = createClient<paths>({
  baseUrl,
  credentials: 'include', // Envoi automatique des cookies (pour le rafraîchissement httpOnly)
});

apiClient.use(authMiddleware);
