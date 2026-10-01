import { apiClient, ErreurApi } from './client';
import { normaliserErreur } from './auth';
import type { components } from './schema';

export type ProduitApi = components['schemas']['Produit'];
export type ProduitCatalogueApi = components['schemas']['ProduitCatalogue'];
export type ProduitCreation = components['schemas']['ProduitCreationRequest'];
export type ProduitModification = components['schemas']['PatchedProduitModificationRequest'];
export type PhotoProduitApi = components['schemas']['PhotoProduit'];
export type CataloguePage = components['schemas']['CatalogueProduits'];
export type MesProduitsPage = components['schemas']['MesProduits'];

export interface FiltresCatalogue {
  categorie?: string;
  region?: string;
  q?: string;
  prixMin?: number;
  prixMax?: number;
  tri?: 'recent' | 'prix_asc' | 'prix_desc';
  page?: number;
  taille?: number;
}

/** GET /produits — catalogue public paginé. */
export async function listerCatalogue(filtres: FiltresCatalogue = {}): Promise<CataloguePage> {
  const { data, error } = await apiClient.GET('/api/v1/produits/', {
    params: {
      query: {
        ...(filtres.categorie ? { categorie: filtres.categorie } : {}),
        ...(filtres.region ? { region: filtres.region } : {}),
        ...(filtres.q ? { q: filtres.q } : {}),
        ...(filtres.prixMin !== undefined ? { prix_min: filtres.prixMin } : {}),
        ...(filtres.prixMax !== undefined ? { prix_max: filtres.prixMax } : {}),
        ...(filtres.tri ? { tri: filtres.tri } : {}),
        ...(filtres.page !== undefined ? { page: filtres.page } : {}),
        ...(filtres.taille !== undefined ? { taille: filtres.taille } : {}),
      },
    },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** GET /produits/{id} — détail (vue complète pour le propriétaire). */
export async function obtenirProduit(
  identifiant: string
): Promise<ProduitApi | ProduitCatalogueApi> {
  const { data, error } = await apiClient.GET('/api/v1/produits/{identifiant}/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data as ProduitApi | ProduitCatalogueApi;
}

/** GET /produits/mes-produits — produits de l'agriculteur, tous statuts. */
export async function listerMesProduits(page = 1): Promise<MesProduitsPage> {
  const { data, error } = await apiClient.GET('/api/v1/produits/mes-produits/', {
    params: { query: { page } },
  });
  if (!data) throw normaliserErreur(error);
  return data;
}

/** POST /produits — publier un produit. */
export async function creerProduit(donnees: ProduitCreation): Promise<ProduitApi> {
  const { data, error } = await apiClient.POST('/api/v1/produits/', { body: donnees });
  if (!data) throw normaliserErreur(error);
  return data as ProduitApi;
}

/** PATCH /produits/{id} — modifier un produit. */
export async function modifierProduit(
  identifiant: string,
  donnees: ProduitModification
): Promise<ProduitApi> {
  const { data, error } = await apiClient.PATCH('/api/v1/produits/{identifiant}/', {
    params: { path: { identifiant } },
    body: donnees,
  });
  if (!data) throw normaliserErreur(error);
  return data as ProduitApi;
}

/** PATCH /produits/{id}/stock — ajuster le stock. */
export async function definirStock(
  identifiant: string,
  quantiteStock: string
): Promise<ProduitApi> {
  const { data, error } = await apiClient.PATCH('/api/v1/produits/{identifiant}/stock/', {
    params: { path: { identifiant } },
    body: { quantite_stock: quantiteStock },
  });
  if (!data) throw normaliserErreur(error);
  return data as ProduitApi;
}

/** POST /produits/{id}/retirer — retirer de la vente. */
export async function retirerProduit(identifiant: string): Promise<ProduitApi> {
  const { data, error } = await apiClient.POST('/api/v1/produits/{identifiant}/retirer/', {
    params: { path: { identifiant } },
  });
  if (!data) throw normaliserErreur(error);
  return data as ProduitApi;
}

/** POST /produits/{id}/photos — rattacher une photo. */
export async function ajouterPhotoProduit(
  identifiant: string,
  fichierId: string
): Promise<PhotoProduitApi> {
  const { data, error } = await apiClient.POST('/api/v1/produits/{identifiant}/photos/', {
    params: { path: { identifiant } },
    body: { fichier_id: fichierId },
  });
  if (!data) throw normaliserErreur(error);
  return data as PhotoProduitApi;
}

/** PUT /produits/{id}/photos — réordonner les photos. */
export async function ordonnerPhotosProduit(
  identifiant: string,
  fichierIds: string[]
): Promise<void> {
  const { data, error } = await apiClient.PUT('/api/v1/produits/{identifiant}/photos/', {
    params: { path: { identifiant } },
    body: { fichier_ids: fichierIds },
  });
  if (!data) throw normaliserErreur(error);
}

/** DELETE /produits/{id}/photos/{fichier_id} — dissocier une photo. */
export async function retirerPhotoProduit(identifiant: string, fichierId: string): Promise<void> {
  const { data, error } = await apiClient.DELETE(
    '/api/v1/produits/{identifiant}/photos/{fichier_id}/',
    { params: { path: { identifiant, fichier_id: fichierId } } }
  );
  if (data === undefined && error) throw normaliserErreur(error);
}

export function estProprietaire(produit: ProduitApi | ProduitCatalogueApi): produit is ProduitApi {
  return 'quantite_reservee' in produit;
}

export function messageErreurProduit(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    if (erreur.code === 'produit_indisponible') return 'Produit indisponible.';
    if (erreur.code === 'stock_insuffisant')
      return 'Stock disponible insuffisant pour cette quantité.';
    if (erreur.code === 'stock_inferieur_reserve')
      return 'Le stock ne peut pas passer sous la quantité déjà réservée.';
    if (erreur.code === 'exploitation_inactive') return 'Impossible : l’exploitation est archivée.';
    if (erreur.code === 'trop_de_photos')
      return `Nombre maximal de photos atteint (${String(erreur.details?.maximum ?? '?')}).`;
    if (erreur.code === 'photo_invalide')
      return 'La photo doit être une image téléversée en contexte « produit ».';
    if (erreur.code === 'prix_invalide') return 'Le prix doit être un montant FCFA positif ou nul.';
    if (erreur.code === 'quantite_invalide') return 'La quantité doit être positive.';
    if (erreur.code === 'ressource_introuvable')
      return 'Produit introuvable ou accès non autorisé.';
    return erreur.message;
  }
  return 'Impossible de joindre AgriSens. Vérifiez votre connexion puis réessayez.';
}

export function formaterPrix(prixFcfa: number): string {
  return `${prixFcfa.toLocaleString('fr-FR')} FCFA`;
}

export function formaterQuantite(quantite: number | string, unite: string): string {
  const valeur = Number(quantite);
  const texte = Number.isFinite(valeur)
    ? valeur.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
    : '—';
  return `${texte} ${unite}`;
}
