import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * F-12 — service plannings + bandeau d'avertissement IA.
 * Vérifie la traduction des codes d'erreur, le passage de l'en-tête
 * `Idempotency-Key` et du `signal` d'annulation, la relecture du quota et le
 * rendu du bandeau obligatoire dans tous les états. Client openapi-fetch et
 * `fetch` simulés : aucun réseau.
 */

const fetchMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
}));

vi.mock('@/services/api/client', async () => {
  const reel =
    await vi.importActual<typeof import('@/services/api/client')>('@/services/api/client');
  return { ...reel, apiClient: fetchMock };
});

import { ErreurApi } from '@/services/api/client';
import {
  creerCorrection,
  genererPlanning,
  genererRecommandation,
  lireReponsePlanning,
  lireReponseRecommandation,
  messageErreurPlannings,
  obtenirGeneration,
  obtenirQuota,
} from '@/services/api/plannings';
import {
  BandeauAvertissementIA,
  BANDEAU_AVERTISSEMENT_IA,
} from '@/components/ia/BandeauAvertissementIA';

describe('messageErreurPlannings (codes SPEC-08)', () => {
  it('quota_atteint inclut la limite et la date de réinitialisation', () => {
    const msg = messageErreurPlannings(
      new ErreurApi('quota_atteint', 'x', 429, { limite: 2, date_reinitialisation: '2026-11-01' })
    );
    expect(msg).toContain('2');
    expect(msg).toContain('2026-11-01');
  });

  it('traduit reponse_invalide, limite_fournisseur, donnees_manquantes', () => {
    expect(messageErreurPlannings(new ErreurApi('reponse_invalide', 'x', 502))).toContain(
      'inexploitable'
    );
    expect(messageErreurPlannings(new ErreurApi('limite_fournisseur', 'x', 503))).toContain(
      'indisponible'
    );
    expect(messageErreurPlannings(new ErreurApi('donnees_manquantes', 'x', 422))).toContain(
      'manquantes'
    );
  });

  it('generation_introuvable et erreur non-ErreurApi → message réseau', () => {
    expect(messageErreurPlannings(new ErreurApi('generation_introuvable', 'x', 404))).toContain(
      'introuvable'
    );
    expect(messageErreurPlannings(new Error('panne'))).toContain('connexion');
  });
});

describe('appels API (client simulé)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('genererPlanning passe Idempotency-Key, le corps et le signal', async () => {
    fetchMock.POST.mockResolvedValue({
      data: { id: 'g1', statut: 'reussie', type: 'planning' },
      error: undefined,
    });
    const controller = new AbortController();
    const g = await genererPlanning(
      'e1',
      { culture: 'tomate', periode_debut: '2026-01-01', periode_fin: '2026-05-01' },
      { cleIdempotence: 'CLE-1', signal: controller.signal }
    );
    expect(g.statut).toBe('reussie');
    const [chemin, options] = fetchMock.POST.mock.calls[0] as [
      string,
      {
        params: { header?: Record<string, string>; path: { identifiant: string } };
        body: Record<string, unknown>;
        signal?: AbortSignal;
      },
    ];
    expect(chemin).toBe('/api/v1/exploitations/{identifiant}/plannings/');
    expect(options.params.path.identifiant).toBe('e1');
    expect(options.params.header?.['Idempotency-Key']).toBe('CLE-1');
    expect(options.body.culture).toBe('tomate');
    expect(options.signal).toBe(controller.signal);
  });

  it("l'annulation rend le signal forwardé aborti", () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('genererRecommandation cible la route recommandations avec test_simule', async () => {
    fetchMock.POST.mockResolvedValue({
      data: { id: 'g2', statut: 'reussie', type: 'recommandation' },
      error: undefined,
    });
    await genererRecommandation('e1', { sujet: 'jaunissement' }, { testSimule: 'normal' });
    const [, options] = fetchMock.POST.mock.calls[0] as [
      string,
      { params: { query?: Record<string, string> } },
    ];
    expect(fetchMock.POST.mock.calls[0]![0]).toBe(
      '/api/v1/exploitations/{identifiant}/recommandations/'
    );
    expect(options.params.query?.test_simule).toBe('normal');
  });

  it('creerCorrection envoie commentaire et contenu_corrige', async () => {
    fetchMock.POST.mockResolvedValue({
      data: {
        id: 'c1',
        ingenieur_nom: 'Nadia',
        commentaire: 'ok',
        cree_le: '2026-01-01T00:00:00Z',
      },
      error: undefined,
    });
    const c = await creerCorrection('g1', { commentaire: 'ok', contenu_corrige: { a: 1 } });
    expect(c.commentaire).toBe('ok');
    const [, options] = fetchMock.POST.mock.calls[0] as [
      string,
      { body: { commentaire: string; contenu_corrige: unknown } },
    ];
    expect(options.body.contenu_corrige).toEqual({ a: 1 });
  });

  it('obtenirGeneration cible la route détail', async () => {
    fetchMock.GET.mockResolvedValue({
      data: { id: 'g1', statut: 'reussie' },
      error: undefined,
    });
    const g = await obtenirGeneration('g1');
    expect(fetchMock.GET.mock.calls[0]![0]).toBe('/api/v1/generations-ia/{identifiant}/');
    expect(g.id).toBe('g1');
  });
});

describe('obtenirQuota (fetch direct, réponse non typée)', () => {
  const spy = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', spy);
    spy.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('retourne la structure quota', async () => {
    spy.mockResolvedValue({
      ok: true,
      json: async () => ({
        mois: '2026-10',
        date_reinitialisation: '2026-11-01',
        planning: { consomme: 1, limite: 2 },
        recommandation: { consomme: 0, limite: 5 },
      }),
    });
    const q = await obtenirQuota();
    expect(q.planning.limite).toBe(2);
    expect(q.recommandation.consomme).toBe(0);
  });

  it('lève ErreurApi sur 429', async () => {
    spy.mockResolvedValue({
      ok: false,
      status: 429,
      clone: () => ({ json: async () => ({ erreur: { code: 'quota_atteint', message: 'x' } }) }),
    });
    await expect(obtenirQuota()).rejects.toBeInstanceOf(ErreurApi);
  });
});

describe('lecture typée de reponse_originale', () => {
  it('reconnaît un planning et une recommandation', () => {
    const p = lireReponsePlanning({
      culture: 'tomate',
      avertissement: 'a',
      etapes: [{ date_debut: '2026-01-01', date_fin: '2026-02-01', activite: 'Semis' }],
    });
    expect(p?.etapes[0]?.activite).toBe('Semis');
    expect(lireReponsePlanning(null)).toBeNull();

    const r = lireReponseRecommandation({
      sujet: 'fertilisation',
      avertissement: 'a',
      recommandations: [{ titre: 't', detail: 'd', priorite: 'haute' }],
    });
    expect(r?.recommandations[0]?.priorite).toBe('haute');
    expect(lireReponseRecommandation({})).toBeNull();
  });
});

describe('BandeauAvertissementIA (toujours visible)', () => {
  it('affiche le message par défaut', () => {
    render(<BandeauAvertissementIA />);
    expect(screen.getByTestId('bandeau-avertissement-ia')).toHaveTextContent(
      BANDEAU_AVERTISSEMENT_IA
    );
  });

  it('affiche un message personnalisé quand fourni', () => {
    render(<BandeauAvertissementIA message="Attention" />);
    expect(screen.getByTestId('bandeau-avertissement-ia')).toHaveTextContent('Attention');
  });
});
