/**
 * Validations Zod du profil professionnel (prompt F-03 frontend points 3-4).
 * Les bornes (tarif, rayon, tailles de fichiers) viennent toujours des
 * paramètres plateforme exposés par GET /parametres/publics — jamais en dur
 * (AGENTS.md) ; ce fichier ne fait que les relayer dans le schéma.
 */

import { z } from 'zod';
import { MESSAGES } from '@/theme/messages';

export interface BornesProfilIngenieur {
  tarifMinFcfa: number;
  tarifMaxFcfa: number;
  rayonMaxKm: number;
}

/** Schéma ING-02 ; `position` est gérée hors champ RHF (SelecteurPosition). */
export function creerSchemaProfilIngenieur(bornes: BornesProfilIngenieur) {
  return z.object({
    specialites: z
      .array(z.string())
      .min(1, 'Choisissez au moins une spécialité.')
      .max(6, 'Six spécialités au maximum.'),
    region: z.string().trim().min(1, MESSAGES.champRequis),
    zoneRayonKm: z
      .number({ invalid_type_error: 'Rayon requis.' })
      .int('Le rayon s’exprime en kilomètres entiers.')
      .min(1, 'Le rayon doit d’au moins 1 km.')
      .max(bornes.rayonMaxKm, `Le rayon maximum autorisé est ${bornes.rayonMaxKm} km.`),
    tarifConsultationFcfa: z
      .number({ invalid_type_error: 'Tarif requis.' })
      .int('Le tarif s’exprime en FCFA entiers.')
      .min(bornes.tarifMinFcfa, `Le tarif minimum est ${bornes.tarifMinFcfa} FCFA.`)
      .max(bornes.tarifMaxFcfa, `Le tarif maximum est ${bornes.tarifMaxFcfa} FCFA.`),
    biographie: z.string().trim().max(2000, 'Biographie limitée à 2000 caractères.'),
    modalites: z.string().trim().max(1000, 'Modalités limitées à 1000 caractères.'),
    disponible: z.boolean(),
  });
}

export type DonneesProfilIngenieur = z.infer<ReturnType<typeof creerSchemaProfilIngenieur>>;

/** Schéma du dépôt d'un justificatif : la pièce doit être téléversée d'abord. */
export const schemaDepotJustificatif = z.object({
  type: z.enum(['diplome', 'piece_identite', 'autre']),
  fichierId: z.string().min(1, 'Téléversez d’abord le document.'),
});

export type DonneesDepotJustificatif = z.infer<typeof schemaDepotJustificatif>;

/** Schéma de la refus d'inscription côté ING-02 non utilisé ; motif admin ADM-02. */
export const schemaMotifAdmin = z.object({
  motif: z.string().trim().min(5, 'Le motif doit comporter au moins 5 caractères.'),
});

export type DonneesMotifAdmin = z.infer<typeof schemaMotifAdmin>;
