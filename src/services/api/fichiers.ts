/**
 * Service API des fichiers (prompt F-03 frontend point 1, SPEC-10).
 *
 * L'upload passe par XMLHttpRequest : seul moyen d'obtenir une vraie barre
 * de progression (prompts F-03, PW-F03-06) tout en portant le jeton
 * d'accès en mémoire et le cookie httpOnly.
 */

import { ErreurApi, PREFICE_API_V1, convertirReponseErreur } from './client';
import { CODE_ERREUR_RESEAU } from './auth';
import { useSessionStore } from '@/stores/session';
import type { components } from './schema';

export type FichierApi = components['schemas']['Fichier'];
export type ContexteFichierApi = components['schemas']['ContexteEnum'];

/** Corps d'erreur déjà typé ou réponse HTTP lue par XHR (hors openapi-fetch). */
function lireErreurXHR(statut: number, corps: string): ErreurApi {
  let donnees: unknown = null;
  try {
    donnees = JSON.parse(corps);
  } catch {
    // corps non JSON (html d'erreur, réponse vide…)
  }
  return convertirReponseErreur(statut, donnees);
}

/**
 * POST /fichiers — téléversement multipart avec progression.
 * `surProgression` reçoit un pourcentage 0-100 ; rejette une ErreurApi
 * typée (`type_fichier_non_autorise`, `fichier_trop_volumineux`, …).
 */
export function televerserFichier(
  fichier: File,
  contexte: ContexteFichierApi,
  surProgression?: (pourcentage: number) => void
): Promise<FichierApi> {
  return new Promise<FichierApi>((resolve, reject) => {
    const requete = new XMLHttpRequest();
    requete.open('POST', `${PREFICE_API_V1}/fichiers/`);
    requete.withCredentials = true;
    const jeton = useSessionStore.getState().token;
    if (jeton) requete.setRequestHeader('Authorization', `Bearer ${jeton}`);
    requete.setRequestHeader('Accept', 'application/json');

    requete.upload.addEventListener('progress', (evenement) => {
      if (evenement.lengthComputable && surProgression) {
        surProgression(Math.round((evenement.loaded / evenement.total) * 100));
      }
    });

    requete.addEventListener('load', () => {
      if (requete.status >= 200 && requete.status < 300) {
        try {
          resolve(JSON.parse(requete.responseText) as FichierApi);
        } catch {
          reject(
            new ErreurApi('reponse_invalide', 'Réponse illisible du serveur.', requete.status)
          );
        }
        return;
      }
      reject(lireErreurXHR(requete.status, requete.responseText));
    });
    requete.addEventListener('error', () => {
      reject(
        new ErreurApi(
          CODE_ERREUR_RESEAU,
          'Impossible de contacter le serveur. Vérifiez votre connexion Internet.',
          0
        )
      );
    });
    requete.addEventListener('abort', () => {
      reject(new ErreurApi(CODE_ERREUR_RESEAU, 'Téléversement interrompu.', 0));
    });

    const corps = new FormData();
    corps.append('fichier', fichier);
    corps.append('contexte', contexte);
    requete.send(corps);
  });
}

/**
 * GET /fichiers/{id} → 302 vers l'URL signée : fetch la suit et rend le
 * contenu. On l'exploite pour l'aperçu local (justificatifs, photos).
 * Renvoie null si l'accès est refusé (le backend répond 404, silencieux).
 */
export async function chargerContenuFichier(id: string): Promise<Blob | null> {
  try {
    const jeton = useSessionStore.getState().token;
    const reponse = await fetch(`${PREFICE_API_V1}/fichiers/${id}/`, {
      credentials: 'include',
      headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
    });
    if (!reponse.ok) return null;
    return await reponse.blob();
  } catch {
    return null;
  }
}
