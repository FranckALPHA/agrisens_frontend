import { apiClient, ErreurApi } from './client';
import { normaliserErreur } from './auth';
import type { components } from './schema';

export type CommandeDetailApi = components['schemas']['CommandeDetail'];
export type CommandeListeApi = components['schemas']['CommandeListe'];
export type LigneCommandeApi = components['schemas']['LigneCommande'];
export type ListeCommandesPage = components['schemas']['ListeCommandes'];
export type StatutCommandeApi = components['schemas']['StatutCommandeEnum'];

export interface LignePanierEnvoi {
  produit_id: string;
  quantite: string;
}

export interface DevisEnvoi {
  lignes: LignePanierEnvoi[];
  adresse_id?: string;
  adresse_texte?: string;
  position?: { type: 'Point'; coordinates: [number, number] };
}

export type DevisApi = Record<string, unknown> & {
  sous_total_fcfa: number;
  frais_livraison_fcfa: number;
  total_fcfa: number;
  distance_km: number;
  lignes: Array<{
    produit_id: string;
    nom_produit: string;
    unite: string;
    quantite: string;
    prix_unitaire_fcfa: number;
    total_ligne_fcfa: number;
  }>;
};

/** POST /commandes/devis — chiffrer sans créer. */
export async function demanderDevis(envoi: DevisEnvoi): Promise<DevisApi> {
  const { data, error } = await apiClient.POST('/api/v1/commandes/devis/', {
    body: envoi as never,
  });
  if (!data) throw normaliserErreur(error);
  return data as unknown as DevisApi;
}

/** POST /commandes — passer la commande. */
export async function creerCommande(envoi: DevisEnvoi): Promise<CommandeDetailApi> {
  const { data, error } = await apiClient.POST('/api/v1/commandes/', {
    body: envoi as never,
  });
  if (!data) throw normaliserErreur(error);
  return data as CommandeDetailApi;
}

/** GET /commandes/mes-achats — commandes de l'acheteur. */
export async function listerMesAchats(statut?: string): Promise<ListeCommandesPage> {
  const { data, error } = await apiClient.GET('/api/v1/commandes/mes-achats/', {
    params: { query: statut ? { statut } : {} },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /commandes/mes-ventes — commandes reçues par l'agriculteur. */
export async function listerMesVentes(statut?: string): Promise<ListeCommandesPage> {
  const { data, error } = await apiClient.GET('/api/v1/commandes/mes-ventes/', {
    params: { query: statut ? { statut } : {} },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /commandes/{id} — détail (parties + admin). */
export async function obtenirCommande(identifiant: string): Promise<CommandeDetailApi> {
  const { data, error } = await apiClient.GET('/api/v1/commandes/{identifiant}/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /commandes/{id}/historique — timeline des statuts. */
export async function obtenirHistoriqueCommande(identifiant: string): Promise<
  Array<{
    ancien_statut: string | null;
    nouveau_statut: string;
    motif: string | null;
    acteur_nom: string | null;
    cree_le: string;
  }>
> {
  const { data, error } = await apiClient.GET('/api/v1/commandes/{identifiant}/historique/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data as Array<{
    ancien_statut: string | null;
    nouveau_statut: string;
    motif: string | null;
    acteur_nom: string | null;
    cree_le: string;
  }>;
}

/** POST /commandes/{id}/accepter — agriculteur, réserve le stock. */
export async function accepterCommande(identifiant: string): Promise<CommandeDetailApi> {
  const { data, error } = await apiClient.POST('/api/v1/commandes/{identifiant}/accepter/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /commandes/{id}/rejeter — agriculteur, motif obligatoire. */
export async function rejeterCommande(
  identifiant: string,
  motif: string
): Promise<CommandeDetailApi> {
  const { data, error } = await apiClient.POST('/api/v1/commandes/{identifiant}/rejeter/', {
    params: { path: { identifiant } },
    body: { motif },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /commandes/{id}/annuler — acheteur, avant paiement. */
export async function annulerCommande(identifiant: string): Promise<CommandeDetailApi> {
  const { data, error } = await apiClient.POST('/api/v1/commandes/{identifiant}/annuler/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /commandes/{id}/preparer — agriculteur, depuis payée. */
export async function preparerCommande(identifiant: string): Promise<CommandeDetailApi> {
  const { data, error } = await apiClient.POST('/api/v1/commandes/{identifiant}/preparer/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

export function messageErreurCommande(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    if (erreur.code === 'commande_vide') return 'Votre panier est vide.';
    if (erreur.code === 'commande_multi_agriculteurs')
      return 'Une commande concerne un seul agriculteur : videz le panier ou commandez séparément.';
    if (erreur.code === 'stock_insuffisant')
      return 'Stock disponible insuffisant pour cette quantité.';
    if (erreur.code === 'produit_indisponible') return 'Produit indisponible.';
    if (erreur.code === 'hors_zone_livraison')
      return 'Adresse hors zone de livraison (50 km maximum).';
    if (erreur.code === 'transition_invalide')
      return 'Cette action n’est plus possible pour cette commande.';
    if (erreur.code === 'motif_obligatoire') return 'Le motif est obligatoire.';
    if (erreur.code === 'quantite_invalide') return 'La quantité doit être positive.';
    if (erreur.code === 'adresse_obligatoire') return 'Choisissez une adresse de livraison.';
    if (erreur.code === 'ressource_introuvable')
      return 'Commande introuvable ou accès non autorisé.';
    return erreur.message;
  }
  return 'Impossible de joindre AgriSens. Vérifiez votre connexion puis réessayez.';
}
