import { Page, expect } from '@playwright/test';

/**
 * Utilitaires pour piloter le simulateur de paiement factice NotchPay.
 */
export async function simulerPaiementReussi(page: Page, reference: string): Promise<void> {
  await page.goto(`http://127.0.0.1:8001/api/v1/dev/notchpay/simulateur/${reference}`);
  await page.click('button[data-action="complete"]');
  await expect(page.locator('text=Paiement validé')).toBeVisible();
}

export async function simulerPaiementEchoue(page: Page, reference: string): Promise<void> {
  await page.goto(`http://127.0.0.1:8001/api/v1/dev/notchpay/simulateur/${reference}`);
  await page.click('button[data-action="fail"]');
  await expect(page.locator('text=Paiement échoué')).toBeVisible();
}
