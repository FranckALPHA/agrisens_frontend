import { Page, CDPSession } from '@playwright/test';

/**
 * Utilitaires pour simuler les conditions réseau du Cameroun (3G / hors ligne).
 */
export async function simulerReseauLent(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page);
  // Profil 3G lente : download 500 kb/s, upload 500 kb/s, RTT 400ms
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
  });
  return client;
}

export async function simulerHorsLigne(page: Page): Promise<void> {
  await page.context().setOffline(true);
}

export async function retablirEnLigne(page: Page): Promise<void> {
  await page.context().setOffline(false);
}
