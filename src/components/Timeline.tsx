import React from 'react';
import { Check, Circle } from 'lucide-react';

export interface EtapeTimeline {
  id: string;
  titre: string;
  date?: string;
  description?: string;
  statut: 'complete' | 'courante' | 'a_venir';
}

export interface TimelineProps {
  etapes: EtapeTimeline[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ etapes, className = '' }) => {
  return (
    <nav aria-label="Étapes du processus" className={`w-full ${className}`}>
      <ol className="overflow-hidden">
        {etapes.map((etape, index) => {
          const estDerniere = index === etapes.length - 1;

          return (
            <li key={etape.id} className="relative pb-8 last:pb-0">
              {!estDerniere && (
                <div
                  className={`absolute left-4 top-4 -ml-px mt-0.5 h-full w-0.5 ${
                    etape.statut === 'complete' ? 'bg-primaire' : 'bg-bordure'
                  }`}
                  aria-hidden="true"
                />
              )}

              <div className="relative flex items-start group">
                <span className="flex items-center h-8">
                  {etape.statut === 'complete' ? (
                    <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-primaire text-white">
                      <Check size={16} aria-hidden="true" />
                    </span>
                  ) : etape.statut === 'courante' ? (
                    <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 border-primaire bg-surface">
                      <span className="w-2.5 h-2.5 rounded-full bg-primaire animate-pulse" />
                    </span>
                  ) : (
                    <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 border-bordure bg-surface text-texte-muet">
                      <Circle size={10} aria-hidden="true" fill="currentColor" />
                    </span>
                  )}
                </span>

                <div className="ml-4 min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <p
                      className={`font-semibold ${
                        etape.statut === 'courante'
                          ? 'text-primaire'
                          : etape.statut === 'complete'
                            ? 'text-texte'
                            : 'text-texte-muet'
                      }`}
                    >
                      {etape.titre}
                    </p>
                    {etape.date && (
                      <time className="text-xs text-texte-secondaire shrink-0 ml-2">
                        {etape.date}
                      </time>
                    )}
                  </div>
                  {etape.description && (
                    <p className="mt-1 text-sm text-texte-secondaire">{etape.description}</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
