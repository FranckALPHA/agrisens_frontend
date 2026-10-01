import React from 'react';
import { BadgeStatut } from '@/components/BadgeStatut';
import { STATUTS_COMMANDE } from '@/theme/statuts';

/** Timeline verticale de l'historique d'une commande (ACH-07). */
export const TimelineCommande: React.FC<{
  lignes: Array<{
    ancien_statut: string | null;
    nouveau_statut: string;
    motif: string | null;
    acteur_nom: string | null;
    cree_le: string;
  }>;
}> = ({ lignes }) => {
  if (lignes.length === 0) {
    return <p className="text-sm text-texte-muet">Aucun historique pour le moment.</p>;
  }
  const formaterDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
    } catch {
      return iso;
    }
  };
  return (
    <ol className="flex flex-col gap-0" data-testid="timeline-commande">
      {lignes.map((ligne, index) => (
        <li key={`${ligne.nouveau_statut}-${index}`} className="flex gap-3">
          <div className="flex flex-col items-center" aria-hidden="true">
            <span className="mt-1.5 h-3 w-3 rounded-full bg-primaire shrink-0" />
            {index < lignes.length - 1 && <span className="w-px flex-1 bg-bordure" />}
          </div>
          <div className="pb-5">
            <p className="flex flex-wrap items-center gap-2">
              <BadgeStatut statut={ligne.nouveau_statut} registre={STATUTS_COMMANDE} taille="sm" />
              <span className="text-xs text-texte-muet">{formaterDate(ligne.cree_le)}</span>
            </p>
            {ligne.acteur_nom && (
              <p className="text-xs text-texte-secondaire mt-0.5">Par {ligne.acteur_nom}</p>
            )}
            {ligne.motif && <p className="text-sm text-texte mt-0.5">{ligne.motif}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};
