/**
 * Validations Zod des formulaires d'authentification (prompt F-02 frontend
 * point 7). Les règles reflètent le backend SPEC-01 : mot de passe 8
 * caractères minimum, téléphone camerounais normalisé E.164 (+237), email
 * facultatif et unique (contrôle d'unicité côté serveur).
 */

import { z } from 'zod';
import { MESSAGES } from '@/theme/messages';

/** Rôles ouverts à l'inscription (le super_admin vient par commande, D-19). */
export const ROLES_INSCRIVABLES = [
  'agriculteur',
  'acheteur',
  'ingenieur_agronome',
  'livreur',
] as const;

export const LIBELLES_ROLES: Record<(typeof ROLES_INSCRIVABLES)[number], string> = {
  agriculteur: 'Agriculteur',
  acheteur: 'Acheteur',
  ingenieur_agronome: 'Ingénieur agronome',
  livreur: 'Livreur',
};

/**
 * Normalise un téléphone camerounais en E.164 : « 6 90 00 00 01 »,
 * « 690000001 », « 00237690000001 » ou « +237690000001 » deviennent
 * « +237690000001 ». Renvoie null si le format est impossible.
 */
export function normaliserTelephone(valeur: string): string | null {
  const chiffres = valeur.replace(/[\s().-]/g, '');
  let corps = chiffres;
  if (corps.startsWith('+237')) corps = corps.slice(4);
  else if (corps.startsWith('00237')) corps = corps.slice(5);
  else if (corps.startsWith('237') && corps.length === 12) corps = corps.slice(3);
  // Un numéro camerounais : 9 chiffres commençant par 6, 7 (mobile) ou 2 (fixe).
  if (!/^[672]\d{8}$/.test(corps)) return null;
  return `+237${corps}`;
}

const telephoneSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.champRequis)
  .refine((valeur) => normaliserTelephone(valeur) !== null, MESSAGES.telephoneInvalide);

const emailFacultatif = z
  .string()
  .trim()
  .optional()
  .refine(
    (valeur) => !valeur || z.string().email().safeParse(valeur).success,
    MESSAGES.emailInvalide
  );

export const schemaInscription = z
  .object({
    role: z.enum(ROLES_INSCRIVABLES),
    nom: z.string().trim().min(2, 'Le nom doit comporter au moins 2 caractères.'),
    telephone: telephoneSchema,
    email: emailFacultatif,
    region: z.string().trim().optional(),
    motDePasse: z.string().min(8, MESSAGES.motDePasseTropCourt),
    confirmation: z.string().min(1, MESSAGES.champRequis),
  })
  .refine((donnees) => donnees.motDePasse === donnees.confirmation, {
    message: MESSAGES.motsDePasseDifferents,
    path: ['confirmation'],
  });

export type DonneesInscription = z.infer<typeof schemaInscription>;

export const schemaConnexion = z.object({
  identifiant: z
    .string()
    .trim()
    .min(1, MESSAGES.champRequis)
    .refine(
      (valeur) =>
        normaliserTelephone(valeur) !== null || z.string().email().safeParse(valeur).success,
      'Saisissez un téléphone camerounais ou une adresse email.'
    ),
  motDePasse: z.string().min(1, MESSAGES.champRequis),
});

export type DonneesConnexion = z.infer<typeof schemaConnexion>;

export const schemaDemandeReinitialisation = z.object({
  telephone: telephoneSchema,
});

export const schemaChangementMotDePasse = z
  .object({
    motDePasseActuel: z.string().min(1, MESSAGES.champRequis),
    nouveauMotDePasse: z.string().min(8, MESSAGES.motDePasseTropCourt),
    confirmation: z.string().min(1, MESSAGES.champRequis),
  })
  .refine((donnees) => donnees.nouveauMotDePasse === donnees.confirmation, {
    message: MESSAGES.motsDePasseDifferents,
    path: ['confirmation'],
  });

export const schemaProfil = z.object({
  nom: z.string().trim().min(2, 'Le nom doit comporter au moins 2 caractères.'),
  email: emailFacultatif,
  region: z.string().trim().optional(),
  // Hypothèse Q-33 : le titulaire peut changer son propre téléphone.
  telephone: telephoneSchema,
});

export const schemaAdresse = z
  .object({
    libelle: z.string().trim().min(2, 'Le libellé est obligatoire.'),
    description: z.string().trim().optional(),
    ville: z.string().trim().min(1, MESSAGES.champRequis),
    region: z.string().trim().min(1, MESSAGES.champRequis),
    latitude: z
      .number({ invalid_type_error: 'Latitude requise.' })
      .min(-90, 'Latitude hors plage (-90 à 90).')
      .max(90, 'Latitude hors plage (-90 à 90).'),
    longitude: z
      .number({ invalid_type_error: 'Longitude requise.' })
      .min(-180, 'Longitude hors plage (-180 à 180).')
      .max(180, 'Longitude hors plage (-180 à 180).'),
  })
  .refine(
    (donnees) => donnees.latitude !== 0 || donnees.longitude !== 0,
    'La position (0, 0) est en plein océan Atlantique : choisissez un point au Cameroun.'
  );

export type DonneesAdresse = z.infer<typeof schemaAdresse>;
