import { apiClient, ErreurApi } from './client';
import { normaliserErreur } from './auth';
import type { components } from './schema';

export type LivraisonApi = components['schemas']['LivraisonDisponible'];
export type LivraisonDetailApi = components['schemas']['LivraisonDetail'];
export type IncidentApi = components['schemas']['Incident'];

export interface ReprogrammerEnvoi {
  adresse_id?: string | null;
  operateur?: 'mtn_momo' | 'orange_money' | null;
  telephone?: string;
}

/** GET /livraisons/disponibles — proposées, triées par distance. */
export async function listerLivraisonsDisponibles(): Promise<LivraisonApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/livraisons/disponibles/');
  if (!data) throw normaliserErreur(error);
  return data as LivraisonApi[];
}

/** GET /livraisons/mes-livraisons — courses du livreur. */
export async function listerMesLivraisons(): Promise<LivraisonApi[]> {
  const { data, error } = await apiClient.GET('/api/v1/livraisons/mes-livraisons/');
  if (!data) throw normaliserErreur(error);
  return data as LivraisonApi[];
}

/** GET /livraisons/{id} — détail selon rôle et étape. */
export async function obtenirLivraison(identifiant: string): Promise<LivraisonDetailApi> {
  const { data, error } = await apiClient.GET('/api/v1/livraisons/{identifiant}/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data as LivraisonDetailApi;
}

/** GET /commandes/{id}/livraison — livraison liée à une commande. */
export async function obtenirLivraisonParCommande(
  commandeId: string
): Promise<LivraisonDetailApi | null> {
  const { data, error } = await apiClient.GET('/api/v1/commandes/{commande_id}/livraison/', {
    params: { path: { commande_id: commandeId } },
  });
  if (!data) {
    const erreur = normaliserErreur(error);
    if (erreur instanceof ErreurApi && erreur.code === 'ressource_introuvable') return null;
    throw erreur;
  }
  return data as LivraisonDetailApi;
}

/** GET /livraisons/{id}/itineraire — GeoJSON départ/arrivée. */
export async function obtenirItineraire(identifiant: string): Promise<{
  point_depart: { type: string; coordinates: number[] };
  point_arrivee: { type: string; coordinates: number[] };
  distance_km: string;
  duree_estimee_min: number | null;
  source: string;
}> {
  const { data, error } = await apiClient.GET('/api/v1/livraisons/{identifiant}/itineraire/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data as {
    point_depart: { type: string; coordinates: number[] };
    point_arrivee: { type: string; coordinates: number[] };
    distance_km: string;
    duree_estimee_min: number | null;
    source: string;
  };
}

/** POST /livraisons/{id}/accepter — un seul gagnant. */
export async function accepterLivraison(identifiant: string): Promise<LivraisonApi> {
  const { data, error } = await apiClient.POST('/api/v1/livraisons/{identifiant}/accepter/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data as LivraisonApi;
}

/** POST /livraisons/{id}/desister. */
export async function desisterLivraison(identifiant: string): Promise<void> {
  const { data, error } = await apiClient.POST('/api/v1/livraisons/{identifiant}/desister/', {
    params: { path: { identifiant } },
  });
  if (data === undefined && error) throw normaliserErreur(error);
}

/** POST /livraisons/{id}/demarrer — produit récupéré, stock consommé. */
export async function demarrerLivraison(identifiant: string): Promise<LivraisonApi> {
  const { data, error } = await apiClient.POST('/api/v1/livraisons/{identifiant}/demarrer/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data as LivraisonApi;
}

/** POST /livraisons/{id}/confirmer-remise — validation du code. */
export async function confirmerRemise(identifiant: string, code: string): Promise<LivraisonApi> {
  const { data, error } = await apiClient.POST(
    '/api/v1/livraisons/{identifiant}/confirmer-remise/',
    { params: { path: { identifiant } }, body: { code } }
  );
  if (!data) throw normaliserErreur(error);
  return data as LivraisonApi;
}

/** POST /livraisons/{id}/incidents — déclaration avec photo possible. */
export async function declarerIncident(
  identifiant: string,
  donnees: { type: string; description?: string; fichier_id?: string | null }
): Promise<IncidentApi> {
  const { data, error } = await apiClient.POST('/api/v1/livraisons/{identifiant}/incidents/', {
    params: { path: { identifiant } },
    body: {
      type: donnees.type as 'client_absent' | 'echec_livraison' | 'produit_endommage' | 'autre',
      description: donnees.description ?? '',
      fichier_id: donnees.fichier_id ?? null,
    },
  });
  if (!data) throw normaliserErreur(error);
  return data as IncidentApi;
}

/** POST /livraisons/{id}/reprogrammer — avec paiement si client absent. */
export async function reprogrammerLivraison(
  identifiant: string,
  donnees: ReprogrammerEnvoi,
  cleIdempotence?: string
): Promise<{
  sans_frais?: boolean;
  livraison_id?: string;
  paiement_id?: string;
  url_paiement?: string;
  montant_fcfa?: number;
}> {
  const { data, error } = await apiClient.POST('/api/v1/livraisons/{identifiant}/reprogrammer/', {
    params: { path: { identifiant } },
    body: {
      adresse_id: donnees.adresse_id ?? null,
      operateur: donnees.operateur ?? null,
      telephone: donnees.telephone ?? '',
    },
    ...(cleIdempotence ? { headers: { 'Idempotency-Key': cleIdempotence } } : {}),
  });
  if (!data) throw normaliserErreur(error);
  return data as {
    sans_frais?: boolean;
    livraison_id?: string;
    paiement_id?: string;
    url_paiement?: string;
    montant_fcfa?: number;
  };
}

/** GET /commandes/{id}/code-remise — code en clair, acheteur uniquement. */
export async function obtenirCodeRemise(commandeId: string): Promise<string> {
  const { data, error } = await apiClient.GET('/api/v1/commandes/{identifiant}/code-remise/', {
    params: { path: { identifiant: commandeId } },
  });
  if (!data) throw normaliserErreur(error);
  return (data as { code: string }).code;
}

/** POST /livraisons/{id}/position — le livreur publie sa position pendant la course. */
export async function publierPositionLivreur(
  identifiant: string,
  position: { type: 'Point'; coordinates: [number, number] }
): Promise<{ position: { type: string; coordinates: number[] }; position_maj_le: string | null }> {
  const { data, error } = await apiClient.POST('/api/v1/livraisons/{identifiant}/position/', {
    params: { path: { identifiant } },
    body: { position },
  });
  if (!data) throw normaliserErreur(error);
  return data as {
    position: { type: string; coordinates: number[] };
    position_maj_le: string | null;
  };
}

export function messageErreurLivraison(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    if (erreur.code === 'livraison_deja_prise')
      return 'Cette livraison vient d’être acceptée par un autre livreur.';
    if (erreur.code === 'livreur_indisponible')
      return 'Passez disponible pour accepter une livraison.';
    if (erreur.code === 'code_incorrect') {
      const restants = erreur.details?.essais_restants;
      return `Code de remise incorrect.${typeof restants === 'number' ? ` (${restants} essai(s) restant(s))` : ''}`;
    }
    if (erreur.code === 'code_bloque')
      return 'Saisie du code bloquée après trop d’échecs : contactez un administrateur.';
    if (erreur.code === 'transition_invalide')
      return 'Cette action n’est plus possible pour cette livraison.';
    if (erreur.code === 'reprogrammations_epuisees')
      return 'Nombre maximal de reprogrammations atteint : un remboursement est proposé.';
    if (erreur.code === 'livraison_introuvable') return 'Aucune livraison pour cette commande.';
    if (erreur.code === 'ressource_introuvable')
      return 'Livraison introuvable ou accès non autorisé.';
    return erreur.message;
  }
  return 'Impossible de joindre AgriSens. Vérifiez votre connexion puis réessayez.';
}

export function formaterDuree(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${reste} min`;
}
