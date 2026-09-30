import React from 'react';

export interface Colonne<T> {
  cle: string;
  enTete: string;
  rendu?: (element: T) => React.ReactNode;
  alignement?: 'gauche' | 'centre' | 'droite';
}

export interface TableauResponsiveProps<T> {
  colonnes: Colonne<T>[];
  donnees: T[];
  cleId: (element: T) => string;
  titreMobile?: (element: T) => React.ReactNode;
  messageVide?: string;
  className?: string;
}

export function TableauResponsive<T>({
  colonnes,
  donnees,
  cleId,
  titreMobile,
  messageVide = 'Aucune donnée disponible.',
  className = '',
}: TableauResponsiveProps<T>) {
  if (donnees.length === 0) {
    return (
      <div className="p-8 text-center text-texte-secondaire border border-bordure rounded-lg bg-surface">
        {messageVide}
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* 1. Vue Ordinateur & Tablette (Tableau classique) */}
      <div className="hidden md:block overflow-x-auto border border-bordure rounded-lg bg-surface shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-bordure text-xs uppercase tracking-wider text-texte-secondaire font-semibold">
            <tr>
              {colonnes.map((col) => (
                <th
                  key={col.cle}
                  scope="col"
                  className={`px-4 py-3 ${
                    col.alignement === 'centre'
                      ? 'text-center'
                      : col.alignement === 'droite'
                        ? 'text-right'
                        : 'text-left'
                  }`}
                >
                  {col.enTete}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure text-sm text-texte">
            {donnees.map((item) => (
              <tr key={cleId(item)} className="hover:bg-surface-survol transition-colors">
                {colonnes.map((col) => (
                  <td
                    key={col.cle}
                    className={`px-4 py-3.5 ${
                      col.alignement === 'centre'
                        ? 'text-center'
                        : col.alignement === 'droite'
                          ? 'text-right'
                          : 'text-left'
                    }`}
                  >
                    {col.rendu
                      ? col.rendu(item)
                      : String((item as Record<string, unknown>)[col.cle] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. Vue Mobile (Cartes empilées pour petit écran) */}
      <div className="md:hidden flex flex-col gap-3">
        {donnees.map((item) => (
          <div
            key={cleId(item)}
            className="p-4 rounded-lg border border-bordure bg-surface shadow-sm flex flex-col gap-2"
          >
            {titreMobile && (
              <div className="font-semibold text-base text-texte pb-2 border-b border-bordure">
                {titreMobile(item)}
              </div>
            )}
            <div className="flex flex-col gap-1.5 text-sm">
              {colonnes.map((col) => (
                <div key={col.cle} className="flex justify-between items-center py-0.5">
                  <span className="text-xs font-medium text-texte-secondaire">{col.enTete} :</span>
                  <span className="text-right">
                    {col.rendu
                      ? col.rendu(item)
                      : String((item as Record<string, unknown>)[col.cle] ?? '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
