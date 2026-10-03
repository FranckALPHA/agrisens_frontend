import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * F-09 — service litiges (remboursements, signalements, évaluations) :
 * traduction des codes d'erreur, garde-fous des motifs et appels des routes
 * via le client openapi-fetch simulé (motif du test de livraisons.test.ts).
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
  demanderRemboursement,
  MOTIFS_JUSTIFICATIF_REQUIS,
  messageErreurLitige,
  obtenirEvaluation,
  traiterSignalement,
} from '@/services/api/litiges';
import { STATUTS_SIGNALEMENT } from '@/theme/statuts';

describe('messageErreurLitige (codes SPEC-05/10)', () => {
  it('traduit le délai dépassé et le justificatif requis', () => {
    expect(messageErreurLitige(new ErreurApi('delai_depasse', 'x', 422))).toContain('48 h');
    expect(messageErreurLitige(new ErreurApi('justificatif_requis', 'x', 422))).toContain(
      'justificatif'
    );
  });

  it('traduit les refus admin et les garde-fous d’évaluation', () => {
    expect(messageErreurLitige(new ErreurApi('reference_obligatoire', 'x', 422))).toContain(
      'référence'
    );
    expect(messageErreurLitige(new ErreurApi('decision_requise', 'x', 422))).toContain('décision');
    expect(messageErreurLitige(new ErreurApi('commande_non_livree', 'x', 409))).toContain(
      'livraison'
    );
    expect(messageErreurLitige(new ErreurApi('evaluation_deja_faite', 'x', 409))).toContain(
      'déjà évalué'
    );
    expect(messageErreurLitige(new ErreurApi('livreur_absent', 'x', 422))).toContain('livreur');
  });

  it('ressource privée → message 404 ; erreur réseau → message générique', () => {
    expect(messageErreurLitige(new ErreurApi('ressource_introuvable', 'x', 404))).toContain(
      'introuvable'
    );
    expect(messageErreurLitige(new Error('panne'))).toContain('connexion');
  });
});

describe('motifs de remboursement', () => {
  it('justificatif obligatoire pour endommagé / incorrect / non reçu, pas pour autre', () => {
    expect(MOTIFS_JUSTIFICATIF_REQUIS.has('produit_endommage')).toBe(true);
    expect(MOTIFS_JUSTIFICATIF_REQUIS.has('produit_incorrect')).toBe(true);
    expect(MOTIFS_JUSTIFICATIF_REQUIS.has('non_recu')).toBe(true);
    expect(MOTIFS_JUSTIFICATIF_REQUIS.has('autre')).toBe(false);
  });

  it('le motif annulation (remboursement automatique) n’est pas proposé à l’acheteur', () => {
    expect(MOTIFS_JUSTIFICATIF_REQUIS.has('annulation' as never)).toBe(false);
  });
});

describe('STATUTS_SIGNALEMENT (registre de badges)', () => {
  it('couvre les quatre statuts de la machine à états 02', () => {
    expect(Object.keys(STATUTS_SIGNALEMENT).sort()).toEqual(
      ['clos_fonde', 'clos_non_fonde', 'en_examen', 'ouvert'].sort()
    );
  });
});

describe('appels API (client simulé)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('demanderRemboursement POST /remboursements/ avec justificatifs vides par défaut', async () => {
    fetchMock.POST.mockResolvedValue({ data: { id: 'r1', statut: 'demande' }, error: undefined });
    const resultat = await demanderRemboursement({
      commande_id: 'c1',
      motif: 'autre',
      montant_demande_fcfa: 2000,
    });
    expect(resultat.statut).toBe('demande');
    const [chemin, options] = fetchMock.POST.mock.calls[0] as [string, { body: unknown }];
    expect(chemin).toBe('/api/v1/remboursements/');
    expect(options.body).toEqual({
      commande_id: 'c1',
      motif: 'autre',
      montant_demande_fcfa: 2000,
      justificatifs: [],
    });
  });

  it('demanderRemboursement propage le delai_depasse (422) soulevé par le middleware', async () => {
    fetchMock.POST.mockResolvedValue({
      data: undefined,
      error: new ErreurApi('delai_depasse', 'Trop tard.', 422),
    });
    const erreur = await demanderRemboursement({
      commande_id: 'c1',
      motif: 'autre',
      montant_demande_fcfa: 1,
    }).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect((erreur as ErreurApi).code).toBe('delai_depasse');
  });

  it('obtenirEvaluation renvoie null si aucune évaluation (404)', async () => {
    fetchMock.GET.mockResolvedValue({
      data: undefined,
      error: new ErreurApi('ressource_introuvable', 'Aucune évaluation.', 404),
    });
    expect(await obtenirEvaluation('c1')).toBeNull();
  });

  it('obtenirEvaluation propage les autres erreurs (500)', async () => {
    fetchMock.GET.mockResolvedValue({
      data: undefined,
      error: new ErreurApi('erreur_serveur', 'x', 500),
    });
    await expect(obtenirEvaluation('c1')).rejects.toThrow(ErreurApi);
  });

  it('traiterSignalement envoie une décision vide par défaut (en_examen)', async () => {
    fetchMock.POST.mockResolvedValue({ data: { id: 's1', statut: 'en_examen' }, error: undefined });
    await traiterSignalement('s1', { statut: 'en_examen' });
    const [, options] = fetchMock.POST.mock.calls[0] as [string, { body: unknown }];
    expect(options.body).toEqual({ statut: 'en_examen', decision: '' });
  });
});
