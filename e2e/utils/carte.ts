import { Page } from '@playwright/test';

/**
 * Utilitaires pour la saisie ou vérification de coordonnées géographiques.
 */
export async function saisirSommetParcelle(
  page: Page,
  index: number,
  latitude: number,
  longitude: number
): Promise<void> {
  await page.fill(`input[name="sommets.${index}.latitude"]`, latitude.toString());
  await page.fill(`input[name="sommets.${index}.longitude"]`, longitude.toString());
}
