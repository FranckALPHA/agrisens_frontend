import { describe, it, expect } from 'vitest';
import { messageErreurEnvoi } from '@/components/fichiers/envoiFichier';
import { CODE_ERREUR_RESEAU } from '@/services/api/auth';
import {
  creerSchemaProfilIngenieur,
  type DonneesProfilIngenieur,
} from '@/pages/ingenieur/validationsProfil';

/**
 * F-03 — validations front du profil pro et messages d'erreur d'envoi :
 * les bornes viennent des paramètres (injectés dans le schéma), jamais en dur.
 */

const bornes = { tarifMinFcfa: 2000, tarifMaxFcfa: 50000, rayonMaxKm: 150 };

function profilValide(surcharges: Partial<DonneesProfilIngenieur> = {}): DonneesProfilIngenieur {
  return {
    specialites: ['maraichage'],
    region: 'littoral',
    zoneRayonKm: 50,
    tarifConsultationFcfa: 10000,
    biographie: 'Agronome terrain.',
    modalites: 'Déplacements en semaine.',
    disponible: true,
    ...surcharges,
  };
}

describe('creerSchemaProfilIngenieur (bornes paramètres)', () => {
  const schema = creerSchemaProfilIngenieur(bornes);

  it('accepte un profil complet dans les bornes', () => {
    expect(schema.safeParse(profilValide()).success).toBe(true);
  });

  it('exige au moins une spécialité', () => {
    const resultat = schema.safeParse(profilValide({ specialites: [] }));
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.message).toMatch(/au moins une spécialité/);
  });

  it('refuse un tarif sous la borne minimale du paramètre', () => {
    const resultat = schema.safeParse(profilValide({ tarifConsultationFcfa: 1000 }));
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.message).toContain('2000');
  });

  it('refuse un tarif au-dessus de la borne maximale du paramètre', () => {
    const resultat = schema.safeParse(profilValide({ tarifConsultationFcfa: 60000 }));
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.message).toContain('50000');
  });

  it('refuse un rayon supérieur au paramètre zone_rayon_km_max (Q-34)', () => {
    const resultat = schema.safeParse(profilValide({ zoneRayonKm: 200 }));
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.message).toContain('150');
  });

  it('refuse un tarif non entier (argent en FCFA entiers)', () => {
    const resultat = schema.safeParse(profilValide({ tarifConsultationFcfa: 10000.5 }));
    expect(resultat.success).toBe(false);
  });
});

describe('messageErreurEnvoi', () => {
  it('explique le rejet d’un type falsifié (fichier .jpg contenant un exécutable)', () => {
    expect(messageErreurEnvoi('type_fichier_non_autorise', '', 5)).toMatch(
      /extension ne correspond pas/
    );
  });

  it('affiche la limite pour un fichier trop volumineux', () => {
    expect(messageErreurEnvoi('fichier_trop_volumineux', '', 5)).toContain('5 Mo');
  });

  it('renvoie le message réseau générique sur connexion faible', () => {
    expect(messageErreurEnvoi(CODE_ERREUR_RESEAU, '', 5)).toContain('connexion');
  });

  it('retombe sur le message du serveur sinon', () => {
    expect(messageErreurEnvoi('autre_code', 'Message serveur.', 5)).toBe('Message serveur.');
  });
});
