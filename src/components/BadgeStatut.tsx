import React from 'react';
import { VarianteStatut, obtenirDefinitionStatut, DefinitionStatut } from '@/theme/statuts';

export interface BadgeStatutProps {
  statut: string;
  registre?: Record<string, DefinitionStatut>;
  textePersonnalise?: string;
  taille?: 'sm' | 'md';
  className?: string;
}

export const BadgeStatut: React.FC<BadgeStatutProps> = ({
  statut,
  registre,
  textePersonnalise,
  taille = 'md',
  className = '',
}) => {
  const definition = obtenirDefinitionStatut(statut, registre);
  const libelle = textePersonnalise || definition.libelle;

  const stylesVariante: Record<VarianteStatut, string> = {
    succes: 'bg-succes-fond text-succes-texte border-emerald-300',
    avertissement: 'bg-avertissement-fond text-avertissement-texte border-amber-300',
    erreur: 'bg-erreur-fond text-erreur-texte border-red-300',
    info: 'bg-info-fond text-info-texte border-sky-300',
    neutre: 'bg-slate-100 text-texte-secondaire border-slate-200',
  };

  const stylesTaille = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  }[taille];

  return (
    <span
      data-testid="badge-statut"
      className={`inline-flex items-center font-medium rounded-full border ${stylesVariante[definition.variante]} ${stylesTaille} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${
          definition.variante === 'succes'
            ? 'bg-succes'
            : definition.variante === 'avertissement'
              ? 'bg-avertissement'
              : definition.variante === 'erreur'
                ? 'bg-erreur'
                : definition.variante === 'info'
                  ? 'bg-info'
                  : 'bg-texte-muet'
        }`}
        aria-hidden="true"
      />
      {libelle}
    </span>
  );
};
