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
    STATUTS_UTILISATEUR,
    STATUTS_PRODUIT,
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
