import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Ligne de panier : photo et prix figés à l'ajout, quantités en nombres. */
export interface LignePanier {
  produitId: string;
  nom: string;
  prixUnitaireFcfa: number;
  unite: string;
  quantite: number;
  agriculteurId: string;
  agriculteurNom: string;
  photoId?: string | null;
}

interface EtatPanier {
  lignes: LignePanier[];
  /** Adresse de livraison choisie, partagée panier ↔ confirmation. */
  adresseId: string | null;
  /** Produit d'un autre agriculteur en attente de décision (vider ou garder). */
  conflitAgricuiteur: { nom: string; agriculteurNom: string } | null;
  ajouter: (ligne: Omit<LignePanier, 'quantite'>, quantite?: number) => void;
  changerQuantite: (produitId: string, quantite: number) => void;
  retirer: (produitId: string) => void;
  vider: () => void;
  choisirAdresse: (adresseId: string) => void;
  confirmerRemplacement: () => void;
  abandonnerRemplacement: () => void;
}

const PANIER_VIDE: Pick<EtatPanier, 'lignes' | 'adresseId' | 'conflitAgricuiteur'> = {
  lignes: [],
  adresseId: null,
  conflitAgricuiteur: null,
};

let enAttente: LignePanier | null = null;

/**
 * Store panier (ACH-04, D-02) : un seul agriculteur par panier, conservé
 * localement (localStorage). Ajouter le produit d'un autre agriculteur
 * propose de vider le panier ; refuser laisse le panier inchangé.
 */
export const usePanierStore = create<EtatPanier>()(
  persist(
    (set, get) => ({
      ...PANIER_VIDE,

      ajouter: (ligne, quantite = 1) => {
        const { lignes } = get();
        const existante = lignes.find((l) => l.produitId === ligne.produitId);
        if (existante) {
          set({
            lignes: lignes.map((l) =>
              l.produitId === ligne.produitId ? { ...l, quantite: l.quantite + quantite } : l
            ),
          });
          return;
        }
        const premier = lignes[0];
        if (premier && premier.agriculteurId !== ligne.agriculteurId) {
          enAttente = { ...ligne, quantite };
          set({
            conflitAgricuiteur: { nom: ligne.nom, agriculteurNom: ligne.agriculteurNom },
          });
          return;
        }
        set({ lignes: [...lignes, { ...ligne, quantite }] });
      },

      changerQuantite: (produitId, quantite) => {
        if (quantite <= 0) {
          set({ lignes: get().lignes.filter((l) => l.produitId !== produitId) });
          return;
        }
        set({
          lignes: get().lignes.map((l) => (l.produitId === produitId ? { ...l, quantite } : l)),
        });
      },

      retirer: (produitId) => {
        set({ lignes: get().lignes.filter((l) => l.produitId !== produitId) });
      },

      vider: () => {
        enAttente = null;
        set({ ...PANIER_VIDE });
      },

      choisirAdresse: (adresseId) => {
        set({ adresseId });
      },

      confirmerRemplacement: () => {
        if (enAttente) {
          set({ lignes: [enAttente], conflitAgricuiteur: null });
          enAttente = null;
        }
      },

      abandonnerRemplacement: () => {
        enAttente = null;
        set({ conflitAgricuiteur: null });
      },
    }),
    {
      name: 'agrisens-panier',
      partialize: (etat) => ({ lignes: etat.lignes, adresseId: etat.adresseId }) as EtatPanier,
    }
  )
);

/** Nombre total d'articles et agriculteur du panier (sélecteurs). */
export function resumerPanier(lignes: LignePanier[]): {
  articles: number;
  agriculteurNom: string | null;
} {
  return {
    articles: lignes.reduce((total, ligne) => total + ligne.quantite, 0),
    agriculteurNom: lignes[0]?.agriculteurNom ?? null,
  };
}
