/**
 * Tests unitaires des validations Zod des formulaires de compte
 * (prompt F-02 frontend point 7). Miroir des règles SPEC-01 côté client :
 * mot de passe 8 caractères, téléphone E.164 +237, email facultatif.
 */
import { describe, it, expect } from 'vitest';
import {
  normaliserTelephone,
  schemaInscription,
  schemaConnexion,
  schemaChangementMotDePasse,
  schemaAdresse,
} from '@/pages/auth/validations';

describe('normaliserTelephone', () => {
  it('accepte les formats usuels camerounais et renvoie du E.164', () => {
    expect(normaliserTelephone('6 90 00 00 01')).toBe('+237690000001');
    expect(normaliserTelephone('690000001')).toBe('+237690000001');
    expect(normaliserTelephone('690-00-00-01')).toBe('+237690000001');
    expect(normaliserTelephone('00237690000001')).toBe('+237690000001');
    expect(normaliserTelephone('+237690000001')).toBe('+237690000001');
    expect(normaliserTelephone('237690000001')).toBe('+237690000001');
    expect(normaliserTelephone('771234567')).toBe('+237771234567'); // mobile 7
    expect(normaliserTelephone('233445566')).toBe('+237233445566'); // fixe 2
  });

  it('refuse les numéros impossibles', () => {
    expect(normaliserTelephone('12345')).toBeNull();
    expect(normaliserTelephone('590000001')).toBeNull(); // ne commence par 6/7/2
    expect(normaliserTelephone('+23769000000')).toBeNull(); // trop court
    expect(normaliserTelephone('')).toBeNull();
  });
});

describe('schemaInscription', () => {
  const valides = {
    role: 'agriculteur',
    nom: 'Paul Mbarga',
    telephone: '690 00 00 01',
    email: '',
    region: 'Littoral',
    motDePasse: 'Motdepasse123!',
    confirmation: 'Motdepasse123!',
  };

  it('accepte un dossier conforme', () => {
    expect(schemaInscription.safeParse(valides).success).toBe(true);
  });

  it('refuse un mot de passe de moins de 8 caractères', () => {
    const resultat = schemaInscription.safeParse({ ...valides, motDePasse: 'court1' });
    expect(resultat.success).toBe(false);
    if (!resultat.success) {
      expect(resultat.error.errors.some((e) => e.path.includes('motDePasse'))).toBe(true);
    }
  });

  it('signale la confirmation différente sur le champ confirmation', () => {
    const resultat = schemaInscription.safeParse({ ...valides, confirmation: 'autre12345' });
    expect(resultat.success).toBe(false);
    if (!resultat.success) {
      expect(resultat.error.errors[0]?.path).toEqual(['confirmation']);
    }
  });

  it('refuse un rôle non inscriptible (admin vient par commande, D-19)', () => {
    expect(schemaInscription.safeParse({ ...valides, role: 'admin' }).success).toBe(false);
  });

  it('refuse un téléphone invalide', () => {
    expect(schemaInscription.safeParse({ ...valides, telephone: '1234' }).success).toBe(false);
  });

  it('accepte un email vide mais refuse un email malformed', () => {
    expect(schemaInscription.safeParse({ ...valides, email: undefined }).success).toBe(true);
    expect(schemaInscription.safeParse({ ...valides, email: 'pas-un-email' }).success).toBe(false);
  });
});

describe('schemaConnexion', () => {
  it('accepte un téléphone ou un email comme identifiant', () => {
    expect(
      schemaConnexion.safeParse({ identifiant: '690 00 00 01', motDePasse: 'x1234567' }).success
    ).toBe(true);
    expect(
      schemaConnexion.safeParse({ identifiant: 'paul@agrisens.cm', motDePasse: 'x1234567' }).success
    ).toBe(true);
  });

  it('refuse une identifiant ni téléphone ni email, et un mot de passe vide', () => {
    expect(schemaConnexion.safeParse({ identifiant: 'toto', motDePasse: 'x' }).success).toBe(false);
    expect(schemaConnexion.safeParse({ identifiant: '690000001', motDePasse: '' }).success).toBe(
      false
    );
  });
});

describe('schemaChangementMotDePasse', () => {
  it('refuse la confirmation différente du nouveau mot de passe', () => {
    const resultat = schemaChangementMotDePasse.safeParse({
      motDePasseActuel: 'ancien123',
      nouveauMotDePasse: 'nouveau123',
      confirmation: 'different123',
    });
    expect(resultat.success).toBe(false);
    if (!resultat.success) {
      expect(resultat.error.errors[0]?.path).toEqual(['confirmation']);
    }
  });

  it('accepte un nouveau mot de passe de 8 caractères minimum confirmé', () => {
    expect(
      schemaChangementMotDePasse.safeParse({
        motDePasseActuel: 'ancien123',
        nouveauMotDePasse: 'nouveau123',
        confirmation: 'nouveau123',
      }).success
    ).toBe(true);
  });
});

describe('schemaAdresse', () => {
  const valides = {
    libelle: 'Champ Nord',
    description: '',
    ville: 'Douala',
    region: 'Littoral',
    latitude: 4.0511,
    longitude: 9.7679,
  };

  it('accepte une adresse complète avec position au Cameroun', () => {
    expect(schemaAdresse.safeParse(valides).success).toBe(true);
  });

  it('refuse la position (0, 0) qui correspond à l’océan Atlantique', () => {
    const resultat = schemaAdresse.safeParse({ ...valides, latitude: 0, longitude: 0 });
    expect(resultat.success).toBe(false);
  });

  it('refuse des coordonnées hors plage', () => {
    expect(schemaAdresse.safeParse({ ...valides, latitude: 95 }).success).toBe(false);
    expect(schemaAdresse.safeParse({ ...valides, longitude: -181 }).success).toBe(false);
  });

  it('exige libellé, ville et région', () => {
    expect(schemaAdresse.safeParse({ ...valides, libelle: ' ' }).success).toBe(false);
    expect(schemaAdresse.safeParse({ ...valides, ville: '' }).success).toBe(false);
    expect(schemaAdresse.safeParse({ ...valides, region: '' }).success).toBe(false);
  });
});
