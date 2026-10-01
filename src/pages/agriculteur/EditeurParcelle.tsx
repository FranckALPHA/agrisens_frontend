import React, { useEffect, useMemo, useRef } from 'react';
import * as L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { Bouton } from '@/components/Bouton';
import { CENTRE_YAOUNDE, type Sommet } from './geometrie';

export interface EditeurParcelleProps {
  sommets: Sommet[];
  surChangement: (sommets: Sommet[]) => void;
}

function arrondir(coordonnee: number): number {
  return Number(coordonnee.toFixed(6));
}

/**
 * Geoman rend ses boutons d'outils comme des liens icon-only sans nom
 * accessible (violation axe `focusable-no-name`) : on recopie le `title`
 * français du conteneur en `aria-label` du bouton, y compris pour les
 * boutons ajoutés dynamiquement pendant le dessin.
 */
function etiqueterBoutonsGeoman(racine: ParentNode): void {
  racine
    .querySelectorAll('a.leaflet-buttons-control-button:not([aria-label])')
    .forEach((bouton) => {
      const titre = (bouton.closest('div[title]') as HTMLElement | null)?.title;
      if (titre) bouton.setAttribute('aria-label', titre);
    });
}

/**
 * Calque de dessin Geoman synchronisé avec les sommets du formulaire.
 * La saisie manuelle (textarea) reste la source stable pour les tests E2E ;
 * le dessin met à jour les mêmes sommets et inversement.
 */
const CalqueDessin: React.FC<EditeurParcelleProps> = ({ sommets, surChangement }) => {
  const carte = useMap();
  const groupeRef = useRef<L.FeatureGroup | null>(null);
  const dernierEmisRef = useRef('');
  const surChangementRef = useRef(surChangement);
  surChangementRef.current = surChangement;

  const lireCouches = React.useCallback(() => {
    const groupe = groupeRef.current;
    if (!groupe) return;
    const polygones = groupe
      .getLayers()
      .filter((couche): couche is L.Polygon => couche instanceof L.Polygon);
    if (polygones.length === 0) {
      if (dernierEmisRef.current !== '[]') {
        dernierEmisRef.current = '[]';
        surChangementRef.current([]);
      }
      return;
    }
    const premier = polygones[0];
    if (!premier) return;
    const anneau = (premier.getLatLngs() as L.LatLng[][])[0] ?? [];
    const prochains = anneau.map((point) => ({
      longitude: arrondir(point.lng),
      latitude: arrondir(point.lat),
    }));
    const cle = JSON.stringify(prochains);
    if (cle !== dernierEmisRef.current) {
      dernierEmisRef.current = cle;
      surChangementRef.current(prochains);
    }
  }, []);

  // Initialisation unique : contrôles Geoman en français + écoutes.
  useEffect(() => {
    const groupe = L.featureGroup().addTo(carte);
    groupeRef.current = groupe;
    carte.pm.setLang('fr');
    carte.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
    });
    const attacher = (couche: L.Layer) => {
      couche.on('pm:edit pm:update pm:dragend', lireCouches);
    };
    const aLaCreation = (evenement: { layer: L.Layer }) => {
      attacher(evenement.layer);
      lireCouches();
    };
    carte.on('pm:create', aLaCreation);
    carte.on('pm:remove', lireCouches);
    etiqueterBoutonsGeoman(carte.getContainer());
    const observateur = new MutationObserver(() => etiqueterBoutonsGeoman(carte.getContainer()));
    observateur.observe(carte.getContainer(), { childList: true, subtree: true });
    return () => {
      observateur.disconnect();
      carte.off('pm:create', aLaCreation);
      carte.off('pm:remove', lireCouches);
      carte.pm.removeControls();
      carte.removeLayer(groupe);
      groupeRef.current = null;
    };
  }, [carte, lireCouches]);

  // Le formulaire (saisie manuelle, GPS, chargement) redessine le calque.
  const cleSommets = JSON.stringify(sommets);
  useEffect(() => {
    const groupe = groupeRef.current;
    if (!groupe || cleSommets === dernierEmisRef.current) return;
    dernierEmisRef.current = cleSommets;
    groupe.clearLayers();
    if (sommets.length >= 3) {
      const polygone = L.polygon(
        sommets.map((s) => [s.latitude, s.longitude] as [number, number]),
        { color: '#1b5e20', fillColor: '#2e7d32', fillOpacity: 0.35 }
      );
      polygone.on('pm:edit pm:update pm:dragend', lireCouches);
      polygone.addTo(groupe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleSommets]);

  // Recadre sur la parcelle dès qu'elle devient dessinable.
  useEffect(() => {
    if (sommets.length >= 3) {
      const limites = L.latLngBounds(
        sommets.map((s) => [s.latitude, s.longitude] as [number, number])
      );
      carte.fitBounds(limites.pad(0.2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sommets.length >= 3]);

  return null;
};

/** AGR-03 — dessin Geoman + aperçu de la parcelle sur fond OpenStreetMap. */
export const EditeurParcelle: React.FC<EditeurParcelleProps> = ({ sommets, surChangement }) => {
  const centre = useMemo<[number, number]>(() => {
    const premier = sommets[0];
    if (premier) return [premier.latitude, premier.longitude];
    return [CENTRE_YAOUNDE.latitude, CENTRE_YAOUNDE.longitude];
  }, [sommets]);

  return (
    <div data-testid="editeur-parcelle">
      <div className="h-72 rounded-lg overflow-hidden border border-bordure">
        <MapContainer
          center={centre}
          zoom={sommets.length > 0 ? 14 : 6}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          aria-label="Carte de dessin de la parcelle"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CalqueDessin sommets={sommets} surChangement={surChangement} />
        </MapContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Bouton
          type="button"
          taille="sm"
          variante="secondaire"
          onClick={() => surChangement([])}
          disabled={sommets.length === 0}
        >
          Effacer le dessin
        </Bouton>
        <p className="text-xs text-texte-secondaire">
          Dessinez avec l’outil polygone, déplacez les sommets pour ajuster, ou saisissez les
          sommets à la main ci-dessous.
        </p>
      </div>
    </div>
  );
};
