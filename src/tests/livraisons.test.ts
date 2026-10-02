import { describe, expect, it } from 'vitest';
import { formaterDuree, messageErreurLivraison } from '@/services/api/livraisons';
import { ErreurApi } from '@/services/api/client';

describe('livraisons (LIV-02/03, ACH-08)', () => {
  it('formate les durées estimées en français', () => {
    expect(formaterDuree(20)).toBe('20 min');
    expect(formaterDuree(60)).toBe('1 h');
    expect(formaterDuree(90)).toBe('1 h 30 min');
    expect(formaterDuree(null)).toBe('—');
    expect(formaterDuree(undefined)).toBe('—');
  });

  it('explique la course déjà prise et les codes', () => {
    expect(messageErreurLivraison(new ErreurApi('livraison_deja_prise', 'x', 409))).toContain(
      'autre livreur'
    );
    expect(messageErreurLivraison(new ErreurApi('code_incorrect', 'x', 422))).toContain(
      'incorrect'
    );
    expect(
      messageErreurLivraison(new ErreurApi('code_incorrect', 'x', 422, { essais_restants: 3 }))
    ).toContain('3');
    expect(messageErreurLivraison(new ErreurApi('code_bloque', 'x', 422))).toContain(
      'administrateur'
    );
  });

  it('explique la reprogrammation épuisée et le hors-ligne', () => {
    expect(messageErreurLivraison(new ErreurApi('reprogrammations_epuisees', 'x', 409))).toContain(
      'remboursement'
    );
    expect(messageErreurLivraison(new Error('panne'))).toContain('AgriSens');
  });
});

describe('saisie du code de remise', () => {
  it('n’accepte que 6 chiffres (garde-fou du motif du champ)', () => {
    const nettoyer = (saisie: string) => saisie.replace(/[^0-9]/g, '').slice(0, 6);
    expect(nettoyer('12a34b').length).toBeLessThanOrEqual(6);
    expect(nettoyer('1234567')).toBe('123456');
    expect(/^[0-9]{6}$/.test(nettoyer('123456'))).toBe(true);
    expect(/^[0-9]{6}$/.test(nettoyer('12345'))).toBe(false);
  });
});
