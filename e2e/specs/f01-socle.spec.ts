import { test, expect } from '@playwright/test';
import { verifierAccessibilite } from '../utils/a11y';

test.describe('F-01 — Socle frontend PWA', () => {
  // PW-F01-01 : Accueil s'affiche -> titre, bouton "Voir le catalogue", aucun mot anglais visible
  test('PW-F01-01 L accueil s affiche sans texte anglais', async ({ page }) => {
    await page.goto('/');

    // 1. Titre et bouton Voir le catalogue
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /voir le catalogue/i })).toBeVisible();

    // 2. Vérification accessibilité (axe-core)
    await verifierAccessibilite(page);

    // 3. Aucun texte anglais dans l'interface
    const texteComplet = await page.innerText('body');
    const motsAnglaisInterdits = [
      /\blogin\b/i,
      /\bsign in\b/i,
      /\bsign up\b/i,
      /\bpassword\b/i,
      /\busername\b/i,
      /\bsubmit\b/i,
      /\bdashboard\b/i,
      /\bcart\b/i,
      /\bcheckout\b/i,
      /\bsettings\b/i,
    ];

    for (const regex of motsAnglaisInterdits) {
      expect(texteComplet).not.toMatch(regex);
    }
  });

  // PW-F01-02 : Page /etat -> "API disponible"
  test('PW-F01-02 Page etat affiche API disponible', async ({ page }) => {
    await page.goto('/etat');

    await expect(page.getByText('API disponible')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Opérationnel')).toBeVisible();

    await verifierAccessibilite(page);
  });

  // PW-F01-03 : API arrêtée (503) -> message d'erreur et bouton "Réessayer"
  test('PW-F01-03 API arretee affiche message francais et bouton Reessayer', async ({ page }) => {
    // Intercepter l'appel /api/v1/sante pour simuler 503
    await page.route('**/api/v1/sante*', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          erreur: {
            code: 'service_indisponible',
            message: 'Le serveur est temporairement inaccessible.',
          },
        }),
      });
    });

    await page.goto('/etat');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: /réessayer/i })).toBeVisible();
  });

  // PW-F01-04 : Manifest valide et Service Worker
  test('PW-F01-04 Manifest PWA valide et Service Worker enregistre', async ({ page, request }) => {
    // 1. Vérification du manifest
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();

    expect(manifest.name).toBe('AgriSens');
    expect(manifest.lang).toBe('fr');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color?.toLowerCase()).toBe('#1b5e20');

    const taillesIcones = (manifest.icons || []).map((i: { sizes: string }) => i.sizes);
    expect(taillesIcones).toContain('192x192');
    expect(taillesIcones).toContain('512x512');

    // 2. Vérification de l'enregistrement du Service Worker
    await page.goto('/');
    const swEnregistre = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg;
    });
    expect(swEnregistre).toBe(true);
  });

  // PW-F01-05 : Responsive (mobile vs ordinateur)
  test('PW-F01-05 Navigation responsive adaptee a l ecran', async ({ page }, testInfo) => {
    await page.goto('/connecte');

    const estMobile = testInfo.project.name === 'mobile';

    if (estMobile) {
      await expect(page.getByTestId('navigation-basse')).toBeVisible();
      await expect(page.getByTestId('menu-lateral')).toBeHidden();
    } else {
      await expect(page.getByTestId('menu-lateral')).toBeVisible();
      await expect(page.getByTestId('navigation-basse')).toBeHidden();
    }
  });

  // PW-F01-06 : URL inconnue -> 404 en français avec retour à l'accueil
  test('PW-F01-06 URL inconnue affiche 404 en francais avec retour accueil', async ({ page }) => {
    await page.goto('/route-qui-n-existe-pas');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: /page introuvable/i })).toBeVisible();
    const boutonRetour = page.getByRole('link', { name: /retour.*accueil/i });
    await expect(boutonRetour).toBeVisible();

    await boutonRetour.click();
    await expect(page).toHaveURL('/');
  });
});
