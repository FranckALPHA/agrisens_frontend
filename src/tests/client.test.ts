import { describe, it, expect } from 'vitest';
import { convertirReponseErreur, ErreurApi } from '@/services/api/client';

describe('client api & convertirReponseErreur', () => {
  it('convertit une réponse d’erreur DRF complète en ErreurApi', () => {
    const drfErrorPayload = {
      erreur: {
        code: 'solde_insuffisant',
        message: 'Votre solde est insuffisant pour finaliser la commande.',
        details: { solde_actuel: 1500, requis: 5000 },
      },
    };

    const erreur = convertirReponseErreur(400, drfErrorPayload);

    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur.code).toBe('solde_insuffisant');
    expect(erreur.message).toBe('Votre solde est insuffisant pour finaliser la commande.');
    expect(erreur.statutHttp).toBe(400);
    expect(erreur.details).toEqual({ solde_actuel: 1500, requis: 5000 });
  });

  it('statut 404 sans corps transforme en ressource_introuvable', () => {
    const erreur = convertirReponseErreur(404, null);

    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur.code).toBe('ressource_introuvable');
    expect(erreur.statutHttp).toBe(404);
  });

  it('statut 500 sans corps transforme en erreur_serveur', () => {
    const erreur = convertirReponseErreur(500, undefined);

    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur.code).toBe('erreur_serveur');
    expect(erreur.statutHttp).toBe(500);
  });
});
