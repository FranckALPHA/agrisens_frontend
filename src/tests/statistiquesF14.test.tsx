import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * F-14 — tests unitaires frontend : service statistiques (appels GET avec
 * filtres de période) et composant GrapheBarres (rendu SVG, cas vide).
 */

const fetchMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  PATCH: vi.fn(),
}));

vi.mock('@/services/api/client', async () => {
  const reel =
    await vi.importActual<typeof import('@/services/api/client')>('@/services/api/client');
  return { ...reel, apiClient: fetchMock };
});

import {
  obtenirMesVentes,
  obtenirStatistiquesPlateforme,
  formaterPeriode,
} from '@/services/api/statistiques';
import { GrapheBarres } from '@/components/GrapheBarres';

beforeEach(() => vi.clearAllMocks());

describe('service statistiques', () => {
  it('mes-ventes passe les filtres de période en query', async () => {
    fetchMock.GET.mockResolvedValue({ data: { serie: [] }, error: null });
    await obtenirMesVentes({ du: '2026-01-01', au: '2026-06-30', granularite: 'mois' });
    expect(fetchMock.GET).toHaveBeenCalledWith(
      '/api/v1/statistiques/mes-ventes/',
      expect.objectContaining({
        params: { query: { du: '2026-01-01', au: '2026-06-30', granularite: 'mois' } },
      })
    );
  });

  it('plateforme sans filtre passe un query vide', async () => {
    fetchMock.GET.mockResolvedValue({ data: { serie: [] }, error: null });
    await obtenirStatistiquesPlateforme();
    expect(fetchMock.GET).toHaveBeenCalledWith(
      '/api/v1/statistiques/plateforme/',
      expect.objectContaining({ params: { query: {} } })
    );
  });

  it('formaterPeriode convertit les mois en français', () => {
    expect(formaterPeriode('2026-03', 'mois')).toBe('mars 2026');
    expect(formaterPeriode('2026-S09', 'semaine')).toBe('2026-S09');
  });
});

describe('GrapheBarres', () => {
  it('rend les barres et la légende', () => {
    const points = [
      { libelle: 'mars 2026', valeur: 4000 },
      { libelle: 'avr. 2026', valeur: 2000 },
    ];
    render(<GrapheBarres points={points} titre="CA" testid="graphe-test" />);
    expect(screen.getByTestId('graphe-test')).toBeInTheDocument();
    expect(screen.getByTestId('barre-mars 2026')).toBeInTheDocument();
    expect(screen.getByTestId('barre-avr. 2026')).toBeInTheDocument();
  });

  it(" affiche un message en l'absence de données", () => {
    render(<GrapheBarres points={[]} titre="CA" testid="graphe-vide" />);
    expect(screen.getByTestId('graphe-barres-vide')).toBeInTheDocument();
  });
});
