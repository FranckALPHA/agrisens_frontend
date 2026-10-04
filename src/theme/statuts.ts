/**
 * Configuration des statuts métier pour l'application AgriSens.
 * Source : docs/02-modele-donnees.md §3.
 * Chaque statut possède un libellé en français et une variante sémantique du thème.
 */

export type VarianteStatut = 'succes' | 'avertissement' | 'erreur' | 'info' | 'neutre';

export interface DefinitionStatut {
  libelle: string;
  variante: VarianteStatut;
}

export const STATUTS_COMMANDE: Record<string, DefinitionStatut> = {
  en_attente: { libelle: 'En attente', variante: 'avertissement' },
  acceptee: { libelle: 'Acceptée', variante: 'info' },
  rejetee: { libelle: 'Rejetée', variante: 'erreur' },
  annulee: { libelle: 'Annulée', variante: 'neutre' },
  paiement_en_attente: { libelle: 'Paiement en attente', variante: 'avertissement' },
  payee: { libelle: 'Payée', variante: 'succes' },
  preparation: { libelle: 'En préparation', variante: 'info' },
  remise_au_livreur: { libelle: 'Remise au livreur', variante: 'info' },
  livree: { libelle: 'Livrée', variante: 'succes' },
  client_absent: { libelle: 'Client absent', variante: 'avertissement' },
  echec_livraison: { libelle: 'Échec de livraison', variante: 'erreur' },
  remboursement_en_attente: { libelle: 'Remboursement en attente', variante: 'avertissement' },
  remboursee: { libelle: 'Remboursée', variante: 'neutre' },
};

export const STATUTS_LIVRAISON: Record<string, DefinitionStatut> = {
  proposee: { libelle: 'Proposée', variante: 'info' },
  acceptee: { libelle: 'Prise en charge', variante: 'info' },
  en_cours: { libelle: 'En cours de livraison', variante: 'avertissement' },
  livree: { libelle: 'Livrée', variante: 'succes' },
  client_absent: { libelle: 'Client absent', variante: 'avertissement' },
  echec_livraison: { libelle: 'Échec', variante: 'erreur' },
  annulee: { libelle: 'Annulée', variante: 'neutre' },
};

export const STATUTS_ACCOMPAGNEMENT: Record<string, DefinitionStatut> = {
  demandee: { libelle: 'Demandé', variante: 'info' },
  acceptee: { libelle: 'Accepté', variante: 'info' },
  refusee: { libelle: 'Refusé', variante: 'erreur' },
  planifiee: { libelle: 'Planifié', variante: 'avertissement' },
  terminee: { libelle: 'Terminé', variante: 'succes' },
  manquee: { libelle: 'Rendez-vous manqué', variante: 'erreur' },
  annulee: { libelle: 'Annulé', variante: 'neutre' },
};

export const STATUTS_PAIEMENT: Record<string, DefinitionStatut> = {
  initie: { libelle: 'Initié', variante: 'info' },
  en_attente: { libelle: 'En attente de validation', variante: 'avertissement' },
  reussi: { libelle: 'Réussi', variante: 'succes' },
  echoue: { libelle: 'Échoué', variante: 'erreur' },
  expire: { libelle: 'Expiré', variante: 'neutre' },
};

export const STATUTS_REMBOURSEMENT: Record<string, DefinitionStatut> = {
  demande: { libelle: 'Demandé', variante: 'info' },
  en_examen: { libelle: 'En examen', variante: 'avertissement' },
  approuve: { libelle: 'Approuvé', variante: 'succes' },
  refuse: { libelle: 'Refusé', variante: 'erreur' },
  en_cours: { libelle: 'En cours', variante: 'avertissement' },
  effectue: { libelle: 'Effectué', variante: 'succes' },
  echoue: { libelle: 'Échoué', variante: 'erreur' },
};

/** Signalements (SPEC-10, machine à états ADM-03). */
export const STATUTS_SIGNALEMENT: Record<string, DefinitionStatut> = {
  ouvert: { libelle: 'Ouvert', variante: 'avertissement' },
  en_examen: { libelle: 'En examen', variante: 'info' },
  clos_fonde: { libelle: 'Closé — fondé', variante: 'erreur' },
  clos_non_fonde: { libelle: 'Closé — non fondé', variante: 'succes' },
};

export const STATUTS_UTILISATEUR: Record<string, DefinitionStatut> = {
  actif: { libelle: 'Actif', variante: 'succes' },
  en_attente_validation: { libelle: 'En attente de validation', variante: 'avertissement' },
  suspendu: { libelle: 'Suspendu', variante: 'erreur' },
  anonymise: { libelle: 'Anonymisé', variante: 'neutre' },
};

export const STATUTS_PRODUIT: Record<string, DefinitionStatut> = {
  disponible: { libelle: 'Disponible', variante: 'succes' },
  epuise: { libelle: 'Épuisé', variante: 'erreur' },
  retire: { libelle: 'Retiré de la vente', variante: 'neutre' },
};

/** Catégories de notifications internes (SPEC-10, FE-05). */
export const STATUTS_NOTIFICATION: Record<string, DefinitionStatut> = {
  commande: { libelle: 'Commande', variante: 'info' },
  paiement: { libelle: 'Paiement', variante: 'succes' },
  livraison: { libelle: 'Livraison', variante: 'info' },
  accompagnement: { libelle: 'Accompagnement', variante: 'info' },
  abonnement: { libelle: 'Abonnement', variante: 'neutre' },
  administration: { libelle: 'Administration', variante: 'avertissement' },
  signalement: { libelle: 'Signalement', variante: 'erreur' },
};

/** Validation du profil ingénieur par l'admin (D-13, ING-02). */
export const STATUTS_VALIDATION_INGENIEUR: Record<string, DefinitionStatut> = {
  en_attente: { libelle: 'En attente de validation', variante: 'avertissement' },
  valide: { libelle: 'Validé', variante: 'succes' },
  refuse: { libelle: 'Refusé', variante: 'erreur' },
};

/** Pièces justificatives (02 §2.8, machine à états soumise → acceptée/rejetée). */
export const STATUTS_JUSTIFICATIF: Record<string, DefinitionStatut> = {
  soumise: { libelle: 'Soumise', variante: 'avertissement' },
  acceptee: { libelle: 'Acceptée', variante: 'succes' },
  rejetee: { libelle: 'Rejetée', variante: 'erreur' },
};

/** Rôles utilisateurs (ADM-02). */
export const STATUTS_ROLE: Record<string, DefinitionStatut> = {
  agriculteur: { libelle: 'Agriculteur', variante: 'succes' },
  acheteur: { libelle: 'Acheteur', variante: 'info' },
  ingenieur_agronome: { libelle: 'Ingénieur agronome', variante: 'avertissement' },
  livreur: { libelle: 'Livreur', variante: 'neutre' },
  admin: { libelle: 'Administrateur', variante: 'erreur' },
  super_admin: { libelle: 'Super administrateur', variante: 'erreur' },
};

/** Statuts d'une génération IA (F-12, SPEC-08). */
export const STATUTS_GENERATION: Record<string, DefinitionStatut> = {
  en_cours: { libelle: 'En cours', variante: 'avertissement' },
  reussie: { libelle: 'Réussie', variante: 'succes' },
  echouee: { libelle: 'Échouée', variante: 'erreur' },
};

/** Types de conversation (F-13, docs/02 §2.7) — libellé + variante du badge. */
export const STATUTS_CONVERSATION: Record<string, DefinitionStatut> = {
  commande: { libelle: 'Commande', variante: 'info' },
  accompagnement: { libelle: 'Accompagnement', variante: 'neutre' },
};

/**
 * Récupère la définition d'un statut donné dans l'un des registres ou une valeur par défaut.
 */
export function obtenirDefinitionStatut(
  code: string,
  registre?: Record<string, DefinitionStatut>
): DefinitionStatut {
  if (registre && code in registre) {
    return registre[code]!;
  }

  const tousLesRegistres = [
    STATUTS_COMMANDE,
    STATUTS_LIVRAISON,
    STATUTS_ACCOMPAGNEMENT,
    STATUTS_PAIEMENT,
    STATUTS_REMBOURSEMENT,
    STATUTS_SIGNALEMENT,
    STATUTS_UTILISATEUR,
    STATUTS_PRODUIT,
    STATUTS_NOTIFICATION,
    STATUTS_VALIDATION_INGENIEUR,
    STATUTS_JUSTIFICATIF,
    STATUTS_GENERATION,
  ];

  for (const reg of tousLesRegistres) {
    if (code in reg) {
      return reg[code]!;
    }
  }

  const lisible = code.replace(/_/g, ' ');
  return {
    libelle: lisible.charAt(0).toUpperCase() + lisible.slice(1),
    variante: 'neutre',
  };
}
