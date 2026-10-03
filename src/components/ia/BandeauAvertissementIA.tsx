import React from 'react';

/**
 * Bandeau d'avertissement obligatoire de la génération IA (F-12).
 * Rappel permanent : l'IA produit une recommandation, jamais un diagnostic
 * (docs/02 §2.5, 09 §AGR-07). Toujours visible, dans tous les états.
 */
export const BANDEAU_AVERTISSEMENT_IA =
  'Ceci est une recommandation générée par une IA, pas un diagnostic agronomique. Faites valider par un ingénieur.';

export const BandeauAvertissementIA: React.FC<{ message?: string }> = ({ message }) => (
  <div
    role="note"
    data-testid="bandeau-avertissement-ia"
    className="rounded-md border border-amber-300 bg-avertissement-fond px-3 py-2 text-sm text-avertissement-texte flex items-start gap-2"
  >
    <span aria-hidden="true" className="mt-0.5">
      ⚠
    </span>
    <span>{message ?? BANDEAU_AVERTISSEMENT_IA}</span>
  </div>
);
