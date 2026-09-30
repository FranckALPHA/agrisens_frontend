import { Page } from '@playwright/test';

export const COORDONNEES_YAOUNDE = {
  latitude: 3.848,
  longitude: 11.5021,
};

export const COORDONNEES_DOUALA = {
  latitude: 4.0511,
  longitude: 9.7679,
};

export async function definirPositionGps(
  page: Page,
  coordonnees = COORDONNEES_YAOUNDE
): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation(coordonnees);
}

export async function refuserGeolocalisation(page: Page): Promise<void> {
  await page.context().clearPermissions();
}
