import { describe, expect, it } from 'vitest';
import { messageErreurPaiement, nouvelleCleIdempotence } from '@/services/api/paiements';
import { ErreurApi } from '@/services/api/client';

describe('paiements (ACH-05)', () => {
  it('explique les refus de paiement en français', () => {
    expect(messageErreurPaiement(new ErreurApi('transition_invalide', 'x', 409))).toContain(
      'ne peut plus être payée'
    );
    expect(messageErreurPaiement(new ErreurApi('operateur_inconnu', 'x', 422))).toContain(
      'MTN ou Orange'
    );
    expect(messageErreurPaiement(new ErreurApi('erreur_fournisseur', 'x', 502))).toContain(
      'indisponible'
    );
    expect(messageErreurPaiement(new Error('panne'))).toContain('AgriSens');
  });

  it('génère des clés d’idempotence uniques', () => {
    const cles = new Set([
      nouvelleCleIdempotence(),
      nouvelleCleIdempotence(),
      nouvelleCleIdempotence(),
    ]);
    expect(cles.size).toBe(3);
  });
});
