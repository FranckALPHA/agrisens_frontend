import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * F-03 — service notifications + cloche : le compteur alimente le badge,
 * l'erreur réseau est normalisée, la liste est rendue dans son enveloppe.
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

import { listerNotifications, obtenirCompteurNotifications } from '@/services/api/notifications';
import { normaliserErreur } from '@/services/api/auth';
import { ErreurApi } from '@/services/api/client';
import { ClocheNotifications } from '@/components/ClocheNotifications';
import { useSessionStore } from '@/stores/session';

describe('service notifications (enveloppe de liste)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /notifications renvoie l’enveloppe {elements, total}', async () => {
    const enveloppe = {
      elements: [
        {
          id: 'n1',
          type: 'administration',
          titre: 'Compte validé',
          contenu: 'Votre dossier est approuvé.',
          lien: '/ingenieur/profil-pro',
          non_lue: true,
          lue_le: null,
          cree_le: new Date().toISOString(),
        },
      ],
      page: 1,
      taille: 20,
      total: 1,
    };
    fetchMock.GET.mockResolvedValue({ data: enveloppe, error: undefined });
    const resultat = await listerNotifications();
    expect(resultat.elements[0]?.titre).toBe('Compte validé');
    expect(resultat.total).toBe(1);
  });

  it('compteur : renvoie le nombre de non lues', async () => {
    fetchMock.GET.mockResolvedValue({ data: { non_lues: 3 }, error: undefined });
    expect(await obtenirCompteurNotifications()).toBe(3);
  });

  it('erreur API normalisée en ErreurApi (justificatif d’un autre → 404)', async () => {
    fetchMock.GET.mockResolvedValue({
      data: undefined,
      error: {
        erreur: { code: 'ressource_introuvable', message: 'Introuvable.', statut_http: 404 },
      },
    });
    await expect(obtenirCompteurNotifications()).rejects.toThrow(ErreurApi);
    const erreur = await obtenirCompteurNotifications().catch((e) => e);
    expect((erreur as { code: string }).code).toBe('ressource_introuvable');
  });

  it('normaliserErreur fabrique une erreur générique sur réponse vide', () => {
    expect(normaliserErreur(undefined)).toBeInstanceOf(ErreurApi);
  });
});

describe('ClocheNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().definirSession('faux_jeton', {
      id: '1',
      telephone: '+237690000001',
      nom: 'Nadia',
      role: 'ingenieur_agronome',
      statutCompte: 'actif',
    });
  });
  afterEach(() => useSessionStore.getState().deconnecter());

  it('affiche le badge du compteur de non lues', async () => {
    fetchMock.GET.mockImplementation((chemin: string) => {
      if (chemin.includes('compteur')) {
        return Promise.resolve({ data: { non_lues: 2 }, error: undefined });
      }
      return Promise.resolve({
        data: { elements: [], page: 1, taille: 20, total: 0 },
        error: undefined,
      });
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(MemoryRouter, null, React.createElement(ClocheNotifications))
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId('compteur-notifications')).toHaveTextContent('2')
    );
  });

  it('n’affiche pas de badge quand tout est lu', async () => {
    fetchMock.GET.mockResolvedValue({ data: { non_lues: 0 }, error: undefined });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(MemoryRouter, null, React.createElement(ClocheNotifications))
      )
    );
    await waitFor(() => expect(screen.getByTestId('bouton-cloche')).toBeInTheDocument());
    expect(screen.queryByTestId('compteur-notifications')).not.toBeInTheDocument();
  });
});
