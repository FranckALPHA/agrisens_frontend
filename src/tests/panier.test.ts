import { beforeEach, describe, expect, it } from 'vitest';
import { obtenirDefinitionStatut, STATUTS_COMMANDE } from '@/theme/statuts';
import { resumerPanier, usePanierStore, type LignePanier } from '@/stores/panier';

function ligne(surcharge: Partial<LignePanier> = {}): Omit<LignePanier, 'quantite'> {
  return {
    produitId: 'p1',
    nom: 'Tomates',
    prixUnitaireFcfa: 500,
    unite: 'kg',
    agriculteurId: 'paul',
    agriculteurNom: 'Paul Mbianda',
    ...surcharge,
  };
}

describe('store panier (D-02 : un seul agriculteur)', () => {
  beforeEach(() => {
    usePanierStore.getState().vider();
    localStorage.clear();
  });

  it('ajoute et cumule les quantités du même produit', () => {
    usePanierStore.getState().ajouter(ligne(), 2);
    usePanierStore.getState().ajouter(ligne(), 3);
    const lignes = usePanierStore.getState().lignes;
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.quantite).toBe(5);
  });

  it('propose de vider le panier pour un autre agriculteur, refus = inchangé', () => {
    usePanierStore.getState().ajouter(ligne(), 2);
    usePanierStore
      .getState()
      .ajouter(
        ligne({ produitId: 'p2', nom: 'Oignons', agriculteurId: 'marie', agriculteurNom: 'Marie' }),
        1
      );
    expect(usePanierStore.getState().lignes).toHaveLength(1);
    expect(usePanierStore.getState().conflitAgricuiteur?.nom).toBe('Oignons');
    usePanierStore.getState().abandonnerRemplacement();
    expect(usePanierStore.getState().lignes).toHaveLength(1);
    expect(usePanierStore.getState().lignes[0]?.produitId).toBe('p1');
    expect(usePanierStore.getState().conflitAgricuiteur).toBeNull();
  });

  it('vider puis ajouter remplace le panier', () => {
    usePanierStore.getState().ajouter(ligne(), 2);
    usePanierStore
      .getState()
      .ajouter(
        ligne({ produitId: 'p2', nom: 'Oignons', agriculteurId: 'marie', agriculteurNom: 'Marie' }),
        4
      );
    usePanierStore.getState().confirmerRemplacement();
    const lignes = usePanierStore.getState().lignes;
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.produitId).toBe('p2');
    expect(lignes[0]?.quantite).toBe(4);
  });

  it('quantité à zéro retire la ligne', () => {
    usePanierStore.getState().ajouter(ligne(), 2);
    usePanierStore.getState().changerQuantite('p1', 0);
    expect(usePanierStore.getState().lignes).toHaveLength(0);
  });

  it('résume articles et agriculteur', () => {
    expect(resumerPanier([])).toEqual({ articles: 0, agriculteurNom: null });
    usePanierStore.getState().ajouter(ligne(), 2);
    expect(resumerPanier(usePanierStore.getState().lignes)).toEqual({
      articles: 2,
      agriculteurNom: 'Paul Mbianda',
    });
  });
});

describe('affichage des statuts de commande', () => {
  it('libelle chaque statut en français', () => {
    expect(STATUTS_COMMANDE['en_attente']?.libelle).toBe('En attente');
    expect(STATUTS_COMMANDE['acceptee']?.libelle).toBe('Acceptée');
    expect(STATUTS_COMMANDE['livree']?.libelle).toBe('Livrée');
    expect(obtenirDefinitionStatut('en_attente', STATUTS_COMMANDE).libelle).toBe('En attente');
  });
});
