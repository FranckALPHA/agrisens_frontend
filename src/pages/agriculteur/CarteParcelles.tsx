import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CENTRE_YAOUNDE, type Sommet } from './geometrie';

export interface ParcelleCarte {
  id: string;
  nom: string;
  sommets: Sommet[];
}

/**
 * AGR-02 — vue carte de toutes les parcelles (tuiles OpenStreetMap,
 * journal Q-08). Lecture seule : le dessin se fait dans AGR-03.
 */
export const CarteParcelles: React.FC<{ parcelles: ParcelleCarte[] }> = ({ parcelles }) => {
  const centre = useMemo<[number, number]>(() => {
    const premier = parcelles[0]?.sommets[0];
    if (premier) return [premier.latitude, premier.longitude];
    return [CENTRE_YAOUNDE.latitude, CENTRE_YAOUNDE.longitude];
  }, [parcelles]);
  const limites = useMemo(() => {
    const points = parcelles.flatMap((p) => p.sommets);
    if (points.length === 0) return null;
    const latitudes = points.map((p) => p.latitude);
    const longitudes = points.map((p) => p.longitude);
    return [
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)],
    ] as [[number, number], [number, number]];
  }, [parcelles]);

  return (
    <div data-testid="carte-parcelles">
      <div className="h-64 rounded-lg overflow-hidden border border-bordure">
        <MapContainer
          center={centre}
          bounds={limites ?? undefined}
          zoom={limites ? undefined : 6}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
          aria-label="Carte de vos parcelles au Cameroun"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {parcelles.map((parcelle) => (
            <Polygon
              key={parcelle.id}
              positions={parcelle.sommets.map(
                (sommet) => [sommet.latitude, sommet.longitude] as [number, number]
              )}
              pathOptions={{ color: '#1b5e20', fillColor: '#2e7d32', fillOpacity: 0.35 }}
            >
              <Tooltip>{parcelle.nom}</Tooltip>
            </Polygon>
          ))}
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-texte-secondaire">
        {parcelles.length} parcelle(s) affichée(s) — fond OpenStreetMap.
      </p>
    </div>
  );
};
