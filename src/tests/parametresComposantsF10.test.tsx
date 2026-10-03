import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * F-10 — page ADM-04 (Paramètres) : illustration d'impact demandée par le
 * journal §4 (course de 6 km avant/après), garde de lecture seule pour l'admin
 * (écriture réservée au super-admin), motif obligatoire et refus des valeurs
 * hors bornes avant tout appel réseau. Services simulés au niveau du module.
 */

const serviceMock = vi.hoisted(() => ({
  listerParametresAdmin: vi.fn(),
  definirParametre: vi.fn(),
  historiqueParametre: vi.fn(),
  restaurerParametre: vi.fn(),
  listerOffresAdmin: vi.fn(),
  creerVersionOffre: vi.fn(),
  listerReferentielsAdmin: vi.fn(),
  ajouterReferentiel: vi.fn(),
  renommerReferentiel: vi.fn(),
  desactiverReferentiel: vi.fn(),
}));

vi.mock('@/services/api/parametres', async () => {
  const reel = await vi.importActual<typeof import('@/services/api/parametres')>(
    '@/services/api/parametres'
  );
  return { ...reel, ...serviceMock };
});

import { FournisseurToast } from '@/components/Toast';
import PageParametresAdmin from '@/pages/admin/PageParametresAdmin';
import { useSessionStore } from '@/stores/session';
import type { components } from '@/services/api/schema';

type ParametreAdmin = components['schemas']['ParametreAdmin'];

const parametre = (surcharges: Partial<ParametreAdmin>): ParametreAdmin => ({
  cle: 'livraison.tarif_km_fcfa',
  groupe: 'livraison',
  valeur: 150,
  minimum: 0,
  maximum: 2000,
  public: true,
  planifiees: [],
  ...surcharges,
});

const REGISTRE_DEMO: ParametreAdmin[] = [
  parametre({ cle: 'livraison.base_fcfa', valeur: 500, maximum: 5000 }),
  parametre({ cle: 'livraison.tarif_km_fcfa', valeur: 150 }),
];

const poserRole = (role: 'admin' | 'super_admin') =>
  useSessionStore.setState({
    utilisateur: {
      id: 'u1',
      telephone: '+237600000000',
      nom: role === 'super_admin' ? 'Mireille' : 'Alain',
      role,
      statutCompte: 'actif',
    },
  });

const rendre = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        FournisseurToast,
        null,
        React.createElement(MemoryRouter, null, React.createElement(PageParametresAdmin))
      )
    )
  );
};

describe('PageParametresAdmin (ADM-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.listerParametresAdmin.mockResolvedValue(REGISTRE_DEMO);
  });

  it('illustre l’impact d’un nouveau tarif km sur une course de 6 km (super-admin)', async () => {
    poserRole('super_admin');
    rendre();
    await screen.findByTestId('parametre-livraison.tarif_km_fcfa');
    fireEvent.click(screen.getByTestId('bouton-modifier-livraison.tarif_km_fcfa'));
    fireEvent.change(screen.getByTestId('champ-valeur-livraison.tarif_km_fcfa'), {
      target: { value: '200' },
    });
    const impact = await screen.findByTestId('impact-livraison.tarif_km_fcfa');
    // base 500 + 6 × 150 = 1 400 FCFA → base 500 + 6 × 200 = 1 700 FCFA
    expect(impact.textContent).toMatch(/1\s?400/);
    expect(impact.textContent).toMatch(/1\s?700/);
    expect(impact.textContent).toContain('6 km');
  });

  it('affiche la bannière de lecture seule et cache les boutons d’écriture à l’admin', async () => {
    poserRole('admin');
    rendre();
    await screen.findByTestId('parametre-livraison.tarif_km_fcfa');
    expect(screen.getByTestId('banniere-lecture-seule')).toBeInTheDocument();
    expect(screen.queryByTestId('bouton-modifier-livraison.tarif_km_fcfa')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('bouton-historique-livraison.tarif_km_fcfa')
    ).not.toBeInTheDocument();
  });

  it('refuse l’enregistrement sans motif, puis transmet valeur et motif', async () => {
    poserRole('super_admin');
    serviceMock.definirParametre.mockResolvedValue({
      id: 'l1',
      valeur: 200,
      date_effet: '2026-10-03T00:00:00Z',
      motif: 'Hausse carburant',
      auteur_nom: 'Mireille',
      cree_le: '2026-10-03T00:00:00Z',
    });
    rendre();
    await waitFor(() => expect(screen.getByTestId('parametre-livraison.tarif_km_fcfa')));
    fireEvent.click(screen.getByTestId('bouton-modifier-livraison.tarif_km_fcfa'));
    fireEvent.change(screen.getByTestId('champ-valeur-livraison.tarif_km_fcfa'), {
      target: { value: '200' },
    });
    expect(screen.getByTestId('bouton-enregistrer-livraison.tarif_km_fcfa')).toBeDisabled();
    fireEvent.change(screen.getByTestId('champ-motif-livraison.tarif_km_fcfa'), {
      target: { value: 'Hausse carburant' },
    });
    fireEvent.click(screen.getByTestId('bouton-enregistrer-livraison.tarif_km_fcfa'));
    await waitFor(() => expect(serviceMock.definirParametre).toHaveBeenCalled());
    expect(serviceMock.definirParametre).toHaveBeenCalledWith('livraison.tarif_km_fcfa', {
      valeur: 200,
      date_effet: undefined,
      motif: 'Hausse carburant',
    });
  });

  it('bloque une valeur hors bornes sans appel API et affiche la règle locale', async () => {
    poserRole('super_admin');
    rendre();
    await waitFor(() => expect(screen.getByTestId('parametre-livraison.tarif_km_fcfa')));
    fireEvent.click(screen.getByTestId('bouton-modifier-livraison.tarif_km_fcfa'));
    fireEvent.change(screen.getByTestId('champ-valeur-livraison.tarif_km_fcfa'), {
      target: { value: '9999' },
    });
    fireEvent.change(screen.getByTestId('champ-motif-livraison.tarif_km_fcfa'), {
      target: { value: 'Test hors bornes' },
    });
    fireEvent.click(screen.getByTestId('bouton-enregistrer-livraison.tarif_km_fcfa'));
    expect(await screen.findByText(/comprise entre/)).toBeInTheDocument();
    expect(serviceMock.definirParametre).not.toHaveBeenCalled();
  });

  it('désactive la restauration quand l’historique compte moins de deux lignes', async () => {
    poserRole('super_admin');
    serviceMock.historiqueParametre.mockResolvedValue([
      {
        id: 'l1',
        valeur: 150,
        date_effet: '2026-09-30T00:00:00Z',
        motif: 'Valeur de démarrage',
        auteur_nom: 'Système',
        cree_le: '2026-09-30T00:00:00Z',
      },
    ]);
    rendre();
    await waitFor(() => expect(screen.getByTestId('parametre-livraison.tarif_km_fcfa')));
    fireEvent.click(screen.getByTestId('bouton-historique-livraison.tarif_km_fcfa'));
    const bouton = await screen.findByTestId('bouton-restaurer');
    expect(bouton).toBeDisabled();
    expect(serviceMock.historiqueParametre).toHaveBeenCalledWith('livraison.tarif_km_fcfa');
  });
});
