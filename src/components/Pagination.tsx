import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  pageCourante: number;
  totalElements: number;
  taillePage: number;
  surChangementPage: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  pageCourante,
  totalElements,
  taillePage,
  surChangementPage,
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalElements / taillePage));
  if (totalPages <= 1) return null;

  const aPrecedent = pageCourante > 1;
  const aSuivant = pageCourante < totalPages;

  // Calcul d'un intervalle de 5 pages max autour de la page courante
  const pages: number[] = [];
  const debut = Math.max(1, pageCourante - 2);
  const fin = Math.min(totalPages, pageCourante + 2);
  for (let i = debut; i <= fin; i++) {
    pages.push(i);
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination des résultats"
      className={`flex items-center justify-between gap-4 py-3 px-2 ${className}`}
    >
      <div className="text-sm text-texte-secondaire">
        Page <span className="font-semibold text-texte">{pageCourante}</span> sur{' '}
        <span className="font-semibold text-texte">{totalPages}</span> ({totalElements} éléments)
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => surChangementPage(pageCourante - 1)}
          disabled={!aPrecedent}
          aria-label="Page précédente"
          className="min-h-tactile min-w-tactile inline-flex items-center justify-center p-2 rounded-md border border-bordure bg-surface text-texte hover:bg-surface-survol disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primaire"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => surChangementPage(p)}
            aria-current={p === pageCourante ? 'page' : undefined}
            className={`min-h-tactile min-w-tactile inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-primaire ${
              p === pageCourante
                ? 'bg-primaire text-white border-primaire'
                : 'bg-surface text-texte border-bordure hover:bg-surface-survol'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          onClick={() => surChangementPage(pageCourante + 1)}
          disabled={!aSuivant}
          aria-label="Page suivante"
          className="min-h-tactile min-w-tactile inline-flex items-center justify-center p-2 rounded-md border border-bordure bg-surface text-texte hover:bg-surface-survol disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primaire"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};
