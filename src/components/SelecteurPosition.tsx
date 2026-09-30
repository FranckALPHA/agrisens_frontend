import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPinned, Navigation } from 'lucide-react';
import { Bouton } from '@/components/Bouton';

export interface PositionGeographique {
  latitude: number;
  longitude: number;
}

interface SelecteurPositionProps {
  value: PositionGeographique | null;
  onChange: (position: PositionGeographique) => void;
  /** Centre initial de la carte quand aucune position n'est choisie (Cameroun). */
  centreParDefaut?: PositionGeographique;
}

const CENTRE_CAMEROUN: PositionGeographique = { latitude: 7.37, longitude: 12.5 };

/** Événements de clic sur la carte pour placer le marqueur. */
const ClicCarte: React.FC<{
  onClic: (position: PositionGeographique) => void;
}> = ({ onClic }) => {
  useMapEvents({
    click(ev) {
      onClic({ latitude: ev.latlng.lat, longitude: ev.latlng.lng });
    },
  });
  return null;
};

/** Recadre la carte sur la position choisie (GPS ou saisie). */
const RecadrageCarte: React.FC<{ position: PositionGeographique | null }> = ({ position }) => {
  const carte = useMap();
  useEffect(() => {
    if (position) {
      carte.setView([position.latitude, position.longitude], Math.max(carte.getZoom(), 12));
    }
  }, [position, carte]);
  return null;
};

/**
 * Sélecteur de position réutilisable (prompt F-02 frontend point 5) :
 * carte OpenStreetMap + bouton « ma position » avec explication AVANT la
 * demande de GPS, saisie manuelle proposée si l'utilisateur refuse.
 */
export const SelecteurPosition: React.FC<SelecteurPositionProps> = ({
  value,
  onChange,
  centreParDefaut = CENTRE_CAMEROUN,
}) => {
  const [explicationVue, setExplicationVue] = useState(true);
  const [gpsErreur, setGpsErreur] = useState<string | null>(null);
  const [gpsEnCours, setGpsEnCours] = useState(false);

  const demanderGps = () => {
    setGpsErreur(null);
    if (!('geolocation' in navigator)) {
      setGpsErreur('Votre appareil ne fournit pas de positionnement ; saisissez les coordonnées.');
      return;
    }
    setGpsEnCours(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsEnCours(false);
        onChange({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      (err) => {
        setGpsEnCours(false);
        setGpsErreur(
          err.code === err.PERMISSION_DENIED
            ? 'Positionnement refusé. Vous pouvez cliquer sur la carte ou saisir les coordonnées à la main.'
            : 'Position indisponible (extérieur ou signal faible). Cliquez sur la carte ou saisissez à la main.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Explication avant la demande de GPS (conventions §6 vie privée) */}
      {explicationVue && !value && (
        <div
          role="note"
          className="p-3 rounded-md border border-bordure bg-slate-50 text-xs text-texte-secondaire flex flex-col gap-2"
        >
          <p>
            <strong className="text-texte">Pour situer cette adresse :</strong> AgriSens utilise
            votre position approximative afin de placer le repère et calculer les distances de
            livraison. Votre position exacte n’est jamais partagée aux autres utilisateurs ; elle
            reste dans votre compte et vous pouvez la modifier à tout moment.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Bouton
              type="button"
              taille="sm"
              onClick={demanderGps}
              chargement={gpsEnCours}
              iconeGauche={<Navigation size={16} aria-hidden="true" />}
            >
              Utiliser ma position
            </Bouton>
            <Bouton
              type="button"
              taille="sm"
              variante="secondaire"
              onClick={() => setExplicationVue(false)}
              iconeGauche={<MapPinned size={16} aria-hidden="true" />}
            >
              Choisir sur la carte / saisir à la main
            </Bouton>
          </div>
        </div>
      )}

      {gpsErreur && (
        <p role="alert" className="text-xs text-erreur font-medium">
          {gpsErreur}
        </p>
      )}

      {/* Carte : cliquer pour placer le repère */}
      <div className="rounded-lg overflow-hidden border border-bordure">
        <MapContainer
          center={[
            value?.latitude ?? centreParDefaut.latitude,
            value?.longitude ?? centreParDefaut.longitude,
          ]}
          zoom={value ? 12 : 6}
          style={{ height: '280px', width: '100%' }}
          scrollWheelZoom
          aria-label="Carte : choisissez la position de l’adresse"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClicCarte onClic={onChange} />
          <RecadrageCarte position={value} />
          {value && (
            <CircleMarker
              center={[value.latitude, value.longitude]}
              radius={8}
              pathOptions={{ color: '#1b5e20', fillColor: '#1b5e20', fillOpacity: 0.6 }}
            />
          )}
        </MapContainer>
      </div>

      {/* Saisie manuelle toujours disponible (refus GPS, connexion faible) */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-texte">
          Latitude
          <input
            name="latitude"
            type="number"
            step="0.000001"
            min={-90}
            max={90}
            inputMode="decimal"
            className="min-h-tactile px-3 py-2 rounded-md border border-bordure bg-surface text-texte text-base focus:outline-none focus:ring-2 focus:ring-primaire"
            value={value?.latitude ?? ''}
            onChange={(ev) => {
              const latitude = Number(ev.target.value);
              const longitude = value?.longitude ?? centreParDefaut.longitude;
              if (!Number.isNaN(latitude)) onChange({ latitude, longitude });
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-texte">
          Longitude
          <input
            name="longitude"
            type="number"
            step="0.000001"
            min={-180}
            max={180}
            inputMode="decimal"
            className="min-h-tactile px-3 py-2 rounded-md border border-bordure bg-surface text-texte text-base focus:outline-none focus:ring-2 focus:ring-primaire"
            value={value?.longitude ?? ''}
            onChange={(ev) => {
              const longitude = Number(ev.target.value);
              const latitude = value?.latitude ?? centreParDefaut.latitude;
              if (!Number.isNaN(longitude)) onChange({ latitude, longitude });
            }}
          />
        </label>
      </div>

      {value && (
        <p className="text-xs text-texte-secondaire flex items-center gap-1">
          <LocateFixed size={14} aria-hidden="true" />
          Position actuelle : {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)} — cliquez
          sur la carte pour déplacer le repère.
        </p>
      )}
    </div>
  );
};
