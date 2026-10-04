import React from 'react';

/**
 * Graphique en barres léger sans dépendance (décision F-14 justifiée au
 * rapport : bundle minimal, hors-ligne PWA, un seul type de graphique demandé).
 * pur SVG/React — recharts ou chart.js écartés (poids > 100 ko gzippé).
 */
export interface PointGraphe {
  /** Libellé affiché sous la barre (période ISO formatée). */
  libelle: string;
  /** Valeur entière (FCFA ou nombre). */
  valeur: number;
}

interface GrapheBarresProps {
  points: PointGraphe[];
  /** Titre lu par les technologies d'assistance et affiché en légende. */
  titre: string;
  /** Formateur de la valeur pour l'infobulle et l'axe (défaut : nombre brut). */
  formater?: (valeur: number) => string;
  testid?: string;
}

const LARGEUR_BARRE = 48;
const HAUTEUR_ZONE = 160;
const MARGE_BASSE = 28;

export const GrapheBarres: React.FC<GrapheBarresProps> = ({ points, titre, formater, testid }) => {
  const format = formater ?? ((v: number) => String(v));
  const maximum = Math.max(...points.map((p) => p.valeur), 1);
  const largeur = Math.max(points.length * (LARGEUR_BARRE + 12), 120);
  const hauteur = HAUTEUR_ZONE + MARGE_BASSE;

  return (
    <figure className="m-0" data-testid={testid ?? 'graphe-barres'}>
      <figcaption className="sr-only">{titre}</figcaption>
      {points.length === 0 ? (
        <p className="text-sm text-texte-muet py-8 text-center" data-testid="graphe-barres-vide">
          Aucune donnée sur la période.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            width={largeur}
            height={hauteur}
            viewBox={`0 0 ${largeur} ${hauteur}`}
            role="img"
            aria-label={titre}
            className="min-w-full"
          >
            {points.map((point, index) => {
              const hauteurBarre = Math.max(Math.round((point.valeur / maximum) * HAUTEUR_ZONE), 2);
              const x = index * (LARGEUR_BARRE + 12) + 6;
              const y = HAUTEUR_ZONE - hauteurBarre;
              return (
                <g key={point.libelle} data-testid={`barre-${point.libelle}`}>
                  <title>
                    {point.libelle} : {format(point.valeur)}
                  </title>
                  <rect
                    x={x}
                    y={y}
                    width={LARGEUR_BARRE}
                    height={hauteurBarre}
                    rx={4}
                    className="fill-primaire"
                  />
                  <text
                    x={x + LARGEUR_BARRE / 2}
                    y={HAUTEUR_ZONE + 16}
                    textAnchor="middle"
                    className="fill-texte-secondaire"
                    fontSize={11}
                  >
                    {point.libelle}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </figure>
  );
};

export default GrapheBarres;
