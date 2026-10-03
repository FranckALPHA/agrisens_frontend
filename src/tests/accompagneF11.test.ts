import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * F-11 — service accompagnement : traduction des codes d'erreur, appels API
 * des principales routes via le client openapi-fetch simulé.
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

import { ErreurApi } from '@/services/api/client';
import {
  accepterAccompagnement,
  changerIngenieur,
  confirmerAccompagnement,
  creerAccompagnement,
  marquerManque,
  messageErreurAccompagnement,
  obtenirDevis,
  planifierAccompagnement,
  refuserAccompagnement,
  terminerAccompagnement,
} from '@/services/api/accompagnements';

describe('messageErreurAccompagnement (codes SPEC-07)', () => {
  it('traduit distance_max_depasee → proposition en ligne', () => {
    expect(messageErreurAccompagnement(new ErreurApi('distance_max_depasee', 'x', 422))).toContain(
      'ligne'
    );
  });

  it('traduit conflit_creneau etingenieur_indisponible', () => {
    expect(messageErreurAccompagnement(new ErreurApi('conflit_creneau', 'x', 409))).toContain(
      'chevauche'
    );
    expect(
      messageErreurAccompagnement(new ErreurApi('ingenieur_indisponible', 'x', 422))
    ).toContain('validé');
  });

  it('couvre motif/observation obligatoires et changement après paiement', () => {
    expect(messageErreurAccompagnement(new ErreurApi('motif_obligatoire', 'x', 422))).toContain(
      'motif'
    );
    expect(
      messageErreurAccompagnement(new ErreurApi('observation_obligatoire', 'x', 422))
    ).toContain('compte rendu');
    expect(
      messageErreurAccompagnement(new ErreurApi('changement_apres_paiement', 'x', 422))
    ).toContain('administrateur');
  });

  it('404 → message introuvable ; erreur non-ErreurApi → message réseau', () => {
    expect(messageErreurAccompagnement(new ErreurApi('ressource_introuvable', 'x', 404))).toContain(
      'introuvable'
    );
    expect(messageErreurAccompagnement(new Error('panne'))).toContain('connexion');
  });
});

describe('appels API (client simulé)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('obtenirDevis POST /accompagnements/devis/', async () => {
    fetchMock.POST.mockResolvedValue({
      data: { total_fcfa: 14_800, consultation_fcfa: 10_000, deplacement_fcfa: 4_800 },
      error: undefined,
    });
    const d = await obtenirDevis({
      exploitation_id: 'e1',
      ingenieur_id: 'i1',
      modalite: 'presentiel',
    });
    expect(d.total_fcfa).toBe(14_800);
    expect(fetchMock.POST.mock.calls[0]![0]).toBe('/api/v1/accompagnements/devis/');
  });

  it('creerAccompagnement passe description null si vide', async () => {
    fetchMock.POST.mockResolvedValue({
      data: { id: 'a1', statut: 'demandee' },
      error: undefined,
    });
    const a = await creerAccompagnement({
      exploitation_id: 'e1',
      ingenieur_id: 'i1',
      modalite: 'en_ligne',
      motif: 'Test',
      description: null,
    });
    expect(a.statut).toBe('demandee');
    const [, options] = fetchMock.POST.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body.description).toBeNull();
  });

  it('accepterAccompagnement POST sans corps', async () => {
    fetchMock.POST.mockResolvedValue({
      data: { id: 'a1', statut: 'acceptee' },
      error: undefined,
    });
    await accepterAccompagnement('a1');
    const [chemin, options] = fetchMock.POST.mock.calls[0] as [
      string,
      { params: { path: { identifiant: string } } },
    ];
    expect(chemin).toBe('/api/v1/accompagnements/{identifiant}/accepter/');
    expect(options.params.path.identifiant).toBe('a1');
  });

  it('refuserAccompagnement envoie le motif', async () => {
    fetchMock.POST.mockResolvedValue({
      data: { id: 'a1', statut: 'refusee' },
      error: undefined,
    });
    await refuserAccompagnement('a1', 'Spécialité différente');
    const [, options] = fetchMock.POST.mock.calls[0] as [string, { body: { motif: string } }];
    expect(options.body.motif).toBe('Spécialité différente');
  });

  it('planifierAccompagnement renvoie le 409 conflit_creneau', async () => {
    fetchMock.POST.mockResolvedValue({
      data: undefined,
      error: new ErreurApi('conflit_creneau', 'x', 409),
    });
    const erreur = await planifierAccompagnement('a1', {
      date_debut: '2026-10-10T10:00:00Z',
      date_fin: '2026-10-10T11:00:00Z',
      lieu_rdv_texte: 'Champ',
    }).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect((erreur as ErreurApi).code).toBe('conflit_creneau');
  });

  it('confirmerAccompagnement transmet Idempotency-Key quand fourni', async () => {
    fetchMock.POST.mockResolvedValue({
      data: {
        paiement_id: 'p1',
        url_paiement: 'https://pay',
        montant_fcfa: 14_800,
        rejoue: false,
        reference_interne: 'ACC-X',
      },
      error: undefined,
    });
    const r = await confirmerAccompagnement('a1', 'mtn_momo', undefined, 'idem-1');
    expect(r.paiement_id).toBe('p1');
    const [, options] = fetchMock.POST.mock.calls[0] as [
      string,
      { params: { header?: Record<string, string> } },
    ];
    expect(options.params.header?.['Idempotency-Key']).toBe('idem-1');
  });

  it('terminerAccompagnement et marquerManque et changerIngenieur', async () => {
    fetchMock.POST.mockResolvedValueOnce({
      data: { id: 'a1', statut: 'terminee' },
      error: undefined,
    })
      .mockResolvedValueOnce({ data: { id: 'a1', statut: 'manquee' }, error: undefined })
      .mockResolvedValueOnce({ data: { id: 'a1', ingenieur: 'i2' }, error: undefined });
    await terminerAccompagnement('a1', 'Recommandations');
    await marquerManque('a1', 'ingenieur');
    await changerIngenieur('a1', 'i2');
    expect(fetchMock.POST).toHaveBeenCalledTimes(3);
    const corps = fetchMock.POST.mock.calls[0] as [string, { body: { observation: string } }];
    expect(corps[1].body.observation).toBe('Recommandations');
    const manque = fetchMock.POST.mock.calls[1] as [string, { body: { absent: string } }];
    expect(manque[1].body.absent).toBe('ingenieur');
    const changer = fetchMock.POST.mock.calls[2] as [string, { body: { ingenieur_id: string } }];
    expect(changer[1].body.ingenieur_id).toBe('i2');
  });
});
