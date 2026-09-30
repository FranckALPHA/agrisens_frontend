import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgeStatut } from '@/components/BadgeStatut';
import {
  STATUTS_COMMANDE,
  STATUTS_LIVRAISON,
  STATUTS_PAIEMENT,
  STATUTS_UTILISATEUR,
  STATUTS_PRODUIT,
  obtenirDefinitionStatut,
} from '@/theme/statuts';

describe('BadgeStatut', () => {
  it('affiche le bon libellé et la bonne variante pour les statuts de commande', () => {
    Object.entries(STATUTS_COMMANDE).forEach(([code, def]) => {
      const { unmount } = render(<BadgeStatut statut={code} registre={STATUTS_COMMANDE} />);
      const badge = screen.getByTestId('badge-statut');
      expect(badge).toHaveTextContent(def.libelle);
      unmount();
    });
  });

  it('affiche le bon libellé et la bonne variante pour les statuts de livraison', () => {
    Object.entries(STATUTS_LIVRAISON).forEach(([code, def]) => {
      const { unmount } = render(<BadgeStatut statut={code} registre={STATUTS_LIVRAISON} />);
      const badge = screen.getByTestId('badge-statut');
      expect(badge).toHaveTextContent(def.libelle);
      unmount();
    });
  });

  it('affiche le bon libellé et la bonne variante pour les statuts de paiement', () => {
    Object.entries(STATUTS_PAIEMENT).forEach(([code, def]) => {
      const { unmount } = render(<BadgeStatut statut={code} registre={STATUTS_PAIEMENT} />);
      const badge = screen.getByTestId('badge-statut');
      expect(badge).toHaveTextContent(def.libelle);
      unmount();
    });
  });

  it('affiche le bon libellé et la bonne variante pour les statuts utilisateur et produit', () => {
    Object.entries(STATUTS_UTILISATEUR).forEach(([code, def]) => {
      const { unmount } = render(<BadgeStatut statut={code} registre={STATUTS_UTILISATEUR} />);
      const badge = screen.getByTestId('badge-statut');
      expect(badge).toHaveTextContent(def.libelle);
      unmount();
    });

    Object.entries(STATUTS_PRODUIT).forEach(([code, def]) => {
      const { unmount } = render(<BadgeStatut statut={code} registre={STATUTS_PRODUIT} />);
      const badge = screen.getByTestId('badge-statut');
      expect(badge).toHaveTextContent(def.libelle);
      unmount();
    });
  });

  it('retourne un repli neutre et lisible pour un statut inconnu', () => {
    const inconnu = obtenirDefinitionStatut('statut_mysterieux');
    expect(inconnu.variante).toBe('neutre');
    expect(inconnu.libelle).toBe('Statut mysterieux');

    render(<BadgeStatut statut="statut_mysterieux" />);
    expect(screen.getByTestId('badge-statut')).toHaveTextContent('Statut mysterieux');
  });
});
