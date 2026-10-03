import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * F-10 — services frontend administration : formatage des valeurs de
 * paramètres, construction des requêtes (chemins, corps, filtres) via le
 * client openapi-fetch simulé (motif de livraisons.test.ts).
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
import { definirParametre, formaterValeurParametre } from '@/services/api/parametres';
import { listerAudit } from '@/services/api/audit';
import { enregistrerReversement, listerSoldesAdmin } from '@/services/api/soldes';

describe('formaterValeurParametre (conventions de clés du registre)', () => {
  it('formate les fcfa, les taux en points de base, les km et les délais', () => {
    expect(formaterValeurParametre('livraison.tarif_km_fcfa', 150)).toBe('150 FCFA');
    expect(formaterValeurParametre('commission.taux_pb', 500)).toBe('5 %');
    expect(formaterValeurParametre('commission.consultation_taux_pb', 1250)).toBe('12.5 %');
    expect(formaterValeurParametre('livraison.distance_max_km', 50)).toBe('50 km');
    expect(formaterValeurParametre('commande.delai_acceptation_h', 24)).toBe('24 h');
    expect(formaterValeurParametre('paiement.verification_apres_min', 15)).toBe('15 min');
    expect(formaterValeurParametre('ia.delai_max_s', 60)).toBe('60 s');
    expect(formaterValeurParametre('livraison.tentatives_code_max', 5)).toBe('5');
  });
});

describe('service parametres (ADM-04)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /admin/parametres/{cle} avec valeur, date d’effet et motif', async () => {
    fetchMock.POST.mockResolvedValue({ data: { id: 'l1', valeur: 200 }, error: undefined });
    const resultat = await definirParametre('livraison.tarif_km_fcfa', {
      valeur: 200,
      date_effet: '2026-11-01T10:00:00.000Z',
      motif: 'Hausse carburant',
    });
    expect(resultat).toMatchObject({ id: 'l1' });
    const [chemin, options] = fetchMock.POST.mock.calls[0] as [string, Record<string, unknown>];
    expect(chemin).toBe('/api/v1/admin/parametres/{cle}/');
    expect(options).toMatchObject({
      params: { path: { cle: 'livraison.tarif_km_fcfa' } },
      body: { valeur: 200, date_effet: '2026-11-01T10:00:00.000Z', motif: 'Hausse carburant' },
    });
  });

  it('convertit une erreur API en ErreurApi (hors bornes, 422)', async () => {
    const erreurBrute = new ErreurApi('valeur_hors_bornes', 'hors bornes', 422, {
      minimum: 0,
      maximum: 2000,
    });
    fetchMock.POST.mockResolvedValue({ data: undefined, error: erreurBrute });
    await expect(
      definirParametre('livraison.tarif_km_fcfa', { valeur: 9999, motif: 'test' })
    ).rejects.toBeInstanceOf(ErreurApi);
  });
});

describe('service audit (ADM-05)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('construit la requête de liste avec les filtres actifs uniquement', async () => {
    fetchMock.GET.mockResolvedValue({
      data: { elements: [], page: 1, taille: 20, total: 0 },
      error: undefined,
    });
    await listerAudit({
      entiteType: 'parametre_plateforme',
      action: 'modifier_parametre',
      page: 2,
    });
    const [chemin, options] = fetchMock.GET.mock.calls[0] as [
      string,
      { params: { query: Record<string, unknown> } },
    ];
    expect(chemin).toBe('/api/v1/admin/audit/');
    expect(options.params.query).toEqual({
      entite_type: 'parametre_plateforme',
      action: 'modifier_parametre',
      page: 2,
    });
  });
});

describe('service soldes (Q-11)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /admin/soldes renvoie la file des soldes positifs', async () => {
    fetchMock.GET.mockResolvedValue({
      data: [{ beneficiaire_id: 'p1', nom: 'Paul', solde: 1425 }],
      error: undefined,
    });
    const resultat = await listerSoldesAdmin();
    expect(resultat[0]).toMatchObject({ nom: 'Paul', solde: 1425 });
  });

  it('POST /admin/reversements transmet référence et opérateur', async () => {
    fetchMock.POST.mockResolvedValue({ data: { id: 'r1', montant_fcfa: 1000 }, error: undefined });
    await enregistrerReversement({
      beneficiaire_id: 'p1',
      montant_fcfa: 1000,
      operateur: 'mtn_momo',
      reference_operateur: 'MTN-123',
    });
    const [chemin, options] = fetchMock.POST.mock.calls[0] as [
      string,
      { body: Record<string, unknown> },
    ];
    expect(chemin).toBe('/api/v1/admin/reversements/');
    expect(options.body).toMatchObject({
      beneficiaire_id: 'p1',
      montant_fcfa: 1000,
      operateur: 'mtn_momo',
      reference_operateur: 'MTN-123',
    });
  });
});
