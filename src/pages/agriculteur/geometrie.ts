import type { ExploitationApi, PolygoneGeoJSON } from '@/services/api/exploitations';

export type Sommet = { longitude: number; latitude: number };

/** Emprise du Cameroun (conventions §3) : mêmes bornes que `commun/geo.py`. */
export const EMPRISE_CAMEROUN = {
  latitudeMin: 1.6,
  latitudeMax: 13.1,
  longitudeMin: 8.4,
  longitudeMax: 16.2,
} as const;

/** Centre de repli des cartes (Yaoundé). */
export const CENTRE_YAOUNDE: Sommet = { longitude: 11.5021, latitude: 3.848 };

export function sommetsVersGeoJSON(sommets: Sommet[]): PolygoneGeoJSON {
  const ouverts = sommets.map(({ longitude, latitude }) => [longitude, latitude]);
  const premier = ouverts[0];
  const dernier = ouverts[ouverts.length - 1];
  const anneau =
    premier && dernier && (premier[0] !== dernier[0] || premier[1] !== dernier[1])
      ? [...ouverts, premier]
      : ouverts;
  return { type: 'Polygon', coordinates: [anneau] };
}

export function texteVersSommets(texte: string): Sommet[] {
  const sommets: Sommet[] = [];
  for (const ligne of texte.split('\n')) {
    const [longitude, latitude] = ligne.split(',').map(Number);
    if (
      typeof longitude === 'number' &&
      typeof latitude === 'number' &&
      Number.isFinite(longitude) &&
      Number.isFinite(latitude)
    ) {
      sommets.push({ longitude, latitude });
    }
  }
  return sommets;
}

export function sommetsVersTexte(sommets: Sommet[]): string {
  return sommets.map(({ longitude, latitude }) => `${longitude}, ${latitude}`).join('\n');
}

export function validerSommets(sommets: Sommet[]): string | null {
  if (sommets.length < 3) return 'Saisissez au moins 3 sommets pour fermer la parcelle.';
  if (
    sommets.some(
      ({ longitude, latitude }) =>
        longitude < EMPRISE_CAMEROUN.longitudeMin ||
        longitude > EMPRISE_CAMEROUN.longitudeMax ||
        latitude < EMPRISE_CAMEROUN.latitudeMin ||
        latitude > EMPRISE_CAMEROUN.latitudeMax
    )
  )
    return 'Chaque sommet doit être situé au Cameroun.';
  return null;
}

/**
 * Estimation locale de la superficie (projection équirectangulaire, hectares).
 * Donne un ordre de grandeur instantané ; seule la valeur calculée par le
 * serveur (géodésique WGS84) fait foi à l'enregistrement.
 */
export function estimerSuperficieHa(sommets: Sommet[]): number | null {
  if (sommets.length < 3) return null;
  const rayon = 6371000;
  const radian = Math.PI / 180;
  const latitudeMoyenne =
    sommets.reduce((total, sommet) => total + sommet.latitude, 0) / sommets.length;
  const projetes = sommets.map((sommet) => ({
    x: rayon * sommet.longitude * radian * Math.cos(latitudeMoyenne * radian),
    y: rayon * sommet.latitude * radian,
  }));
  let doubleAire = 0;
  for (let i = 0; i < projetes.length; i += 1) {
    const actuel = projetes[i];
    const suivant = projetes[(i + 1) % projetes.length];
    if (!actuel || !suivant) continue;
    doubleAire += actuel.x * suivant.y - suivant.x * actuel.y;
  }
  return Math.abs(doubleAire) / 2 / 10000;
}

export function formaterSuperficie(hectares: number | string): string {
  const valeur = Number(hectares);
  if (!Number.isFinite(valeur)) return '—';
  return `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ha`;
}

/**
 * Extrait les sommets d'une parcelle reçue de l'API (anneau extérieur,
 * sans le point de fermeture répété), avec resserrement des types générés.
 */
export function extraireSommets(parcelle: ExploitationApi['parcelle']): Sommet[] {
  const anneauBrut = parcelle.coordinates[0];
  if (!Array.isArray(anneauBrut)) return [];
  const points = anneauBrut.filter(
    (point): point is [number, number] =>
      Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number'
  );
  if (points.length === 0) return [];
  const premier = points[0];
  const dernier = points[points.length - 1];
  const ouvert =
    premier && dernier && premier[0] === dernier[0] && premier[1] === dernier[1]
      ? points.slice(0, -1)
      : points;
  return ouvert.map(([longitude, latitude]) => ({ longitude, latitude }));
}
