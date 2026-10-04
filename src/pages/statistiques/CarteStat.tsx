import React from 'react';

/** Carte de chiffre clé des statistiques (F-14, AGR-09 / ADM-01). */
interface CarteStatProps {
  id: string;
  libelle: string;
  valeur: string;
  detail?: string;
  testid?: string;
}

export const CarteStat: React.FC<CarteStatProps> = ({ id, libelle, valeur, detail, testid }) => (
  <div
    className="p-4 rounded-lg border border-bordure bg-surface"
    data-testid={testid ?? `carte-stat-${id}`}
  >
    <p className="text-xs text-texte-secondaire">{libelle}</p>
    <p className="text-2xl font-bold text-texte leading-none mt-1" data-testid={`valeur-${id}`}>
      {valeur}
    </p>
    {detail ? <p className="text-xs text-texte-muet mt-1">{detail}</p> : null}
  </div>
);

export default CarteStat;
