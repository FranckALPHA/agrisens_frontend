import { describe, expect, it } from 'vitest';
import { formaterPrix, formaterQuantite, messageErreurProduit } from '@/services/api/produits';
import { ErreurApi } from '@/services/api/client';

describe('formatage des produits', () => {
  it('formate les prix en FCFA au format français', () => {
    expect(formaterPrix(1400)).toContain('1');
    expect(formaterPrix(1400)).toContain('FCFA');
    expect(formaterPrix(0)).toContain('0');
  });

  it('formate les quantités avec leur unité', () => {
    expect(formaterQuantite('100.000', 'kg')).toContain('kg');
    expect(formaterQuantite('100.000', 'kg')).toContain('100');
    expect(formaterQuantite('0', 'sac')).toContain('sac');
    expect(formaterQuantite('XXX', 'kg')).toContain('—');
  });
});

describe("messages d'erreur des produits", () => {
  it('explique le produit indisponible et le stock insuffisant', () => {
    expect(messageErreurProduit(new ErreurApi('produit_indisponible', 'x', 404))).toContain(
      'indisponible'
    );
    expect(messageErreurProduit(new ErreurApi('stock_insuffisant', 'x', 409))).toContain(
      'insuffisant'
    );
  });

  it('indique la limite de photos et le refus sous le stock réservé', () => {
    expect(
      messageErreurProduit(new ErreurApi('trop_de_photos', 'x', 422, { maximum: 5 }))
    ).toContain('5');
    expect(messageErreurProduit(new ErreurApi('stock_inferieur_reserve', 'x', 422))).toContain(
      'réservée'
    );
  });

  it('retombe sur un message réseau générique sans ErreurApi', () => {
    expect(messageErreurProduit(new Error('boom'))).toContain('AgriSens');
    expect(messageErreurProduit(null)).toContain('AgriSens');
  });
});
