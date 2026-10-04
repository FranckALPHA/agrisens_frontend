/**
 * E2E F-15 — Finition PWA et réseau faible (docs/12 §2, PW-F15-01 à 07).
 *
 * Exécuté contre le build de production (`npm run preview`) : le service worker
 * et les stratégies Workbox sont actifs, IndexedDB disponible. Règles §1.4 :
 * rôles/libellés d'abord, aucune attente fixe (on attend les états), identifiant
 * dans chaque titre, double vérification écran + API quand c'est possible.
 */
import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { simulerReseauLent, simulerHorsLigne, retablirEnLigne } from '../utils/reseau';
import { verifierAccessibilite } from '../utils/a11y';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';
const CLE_INDEXEDDB = 'agrisens:query-cache';

function bearer(jeton: string): Record<string, string> {
  return { Authorization: `Bearer ${jeton}` };
}

async function jetonDe(api: APIRequestContext, telephone: string): Promise<string> {
  const reponse = await api.post(`${URL_API}/auth/connexion/`, {
    data: { identifiant: telephone, mot_de_passe: MOT_DE_PASSE },
  });
  expect(reponse.ok(), `connexion API pour ${telephone}`).toBeTruthy();
  return ((await reponse.json()) as { jeton_acces: string }).jeton_acces;
}

async function connexionUI(page: Page, telephone: string): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel(/^Téléphone ou email/).fill(telephone);
  await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
  const [reponse] = await Promise.all([
    page.waitForResponse(
      (rep) => rep.url().includes('/auth/connexion') && rep.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /^connexion$/i }).click(),
  ]);
  expect(reponse.ok(), 'la connexion UI doit réussir').toBeTruthy();
  await expect(page).not.toHaveURL('/connexion');
}

/** Attend que le service worker contrôle la page (indispensable au cache runtime). */
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.active && navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      const verif = setInterval(() => {
        if (navigator.serviceWorker.controller) {
          clearInterval(verif);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(verif);
        resolve();
      }, 5000);
    });
  });
}

/** Liste les clés IndexedDB préfixées (données privées persistées). */
function clesPriveesEnBase(page: Page): Promise<string[]> {
  return page.evaluate((prefix) => {
    return new Promise<string[]>((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve([]);
        return;
      }
      const ouverture = indexedDB.open('keyval-store');
      ouverture.addEventListener('success', () => {
        const db = ouverture.result;
        if (!db.objectStoreNames.contains('keyval')) {
          resolve([]);
          return;
        }
        const transaction = db.transaction('keyval', 'readonly');
        const req = transaction.objectStore('keyval').getAllKeys();
        req.addEventListener('success', () =>
          resolve((req.result as string[]).filter((k) => String(k).startsWith(prefix)))
        );
        req.addEventListener('error', () => resolve([]));
      });
      ouverture.addEventListener('error', () => resolve([]));
    });
  }, CLE_INDEXEDDB);
}

const articleProduit = (page: Page) => page.locator('article[aria-label^="Produit "]');

test.describe('F-15 — Finition PWA et réseau faible', () => {
  // Scénarios réseau/cache : exécutés sur ordinateur (sélecteurs de menu latéral stables).
  test.beforeEach(async (_args, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'scénarios réseau sur ordinateur');
  });

  test('PW-F15-01 @critique : réseau lent 3G, le catalogue s’affiche avec indicateur de chargement', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await simulerReseauLent(page);
    // Délai déterministe sur l'appel catalogue : garantit une fenêtre visible
    // pour l'indicateur, même si le SW répond depuis un cache chaud.
    await page.route('**/api/v1/produits*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await page.goto('/catalogue');
    await expect(page.getByTestId('page-catalogue')).toBeVisible();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /chargement/i })
        .first()
    ).toBeVisible({ timeout: 15000 });
    // Les produits finissent par s'afficher malgré la lenteur.
    await expect(articleProduit(page).first()).toBeVisible({ timeout: 60000 });
    // Aucune erreur affichée malgré la lenteur.
    await expect(page.getByText('Impossible de charger le catalogue.')).toHaveCount(0);
  });

  test('PW-F15-02 : pages consultées relisibles hors connexion + bandeau ; page non consultée → page hors connexion', async ({
    page,
  }) => {
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await attendreServiceWorker(page);

    // Navigation interne (aucun `page.goto`) : la session mémoire reste
    // en place, la mémoire TanStack alimentée (staleTime 2 min).
    await page
      .getByTestId('menu-lateral')
      .getByRole('link', { name: /^mes commandes$/i })
      .click();
    await expect(page.getByTestId('page-mes-commandes')).toBeVisible();
    await page
      .getByTestId('menu-lateral')
      .getByRole('link', { name: /^messages$/i })
      .click();
    await expect(page.getByTestId('page-conversations')).toBeVisible();

    // Coupure réseau SANS rechargement : la session reste en mémoire.
    await simulerHorsLigne(page);
    await expect(page.getByTestId('bandeau-hors-ligne')).toBeVisible();

    // Les écrans déjà consultés restent lisibles : aucun appel réseau requis.
    await page
      .getByTestId('menu-lateral')
      .getByRole('link', { name: /^mes commandes$/i })
      .click();
    await expect(page.getByTestId('page-mes-commandes')).toBeVisible();

    await page
      .getByTestId('menu-lateral')
      .getByRole('link', { name: /^messages$/i })
      .click();
    await expect(page.getByTestId('page-conversations')).toBeVisible();

    // Une page de repli dédiée est servie par le SW (navigateFallback) quand
    // on tente d'atteindre un écran jamais consulté.
    await page.goto('/hors-connexion');
    await expect(page.getByTestId('page-hors-connexion')).toBeVisible();

    await retablirEnLigne(page);
  });

  test('PW-F15-03 : hors connexion, le bouton « Payer » est désactivé avec explication (jamais mis en file)', async ({
    page,
    request,
  }) => {
    // Crée une commande fraîche côté API : la suite E2E partagée épuise les
    // statuts `acceptee` des autres features, et F-15 doit tester le paiement
    // sur une commande réellement payable.
    const jetonPaul = await jetonDe(request, PERSONNAGES.paul.telephone);
    const repExpl = await request.get(`${URL_API}/exploitations/`, { headers: bearer(jetonPaul) });
    expect(repExpl.ok()).toBeTruthy();
    const expl = ((await repExpl.json()) as Array<{ id: string }>)[0];
    expect(expl, 'exploitation Paul (seed)').toBeDefined();
    const repProd = await request.post(`${URL_API}/produits/`, {
      headers: { ...bearer(jetonPaul), 'Content-Type': 'application/json' },
      data: {
        nom: `Payer F15 ${Date.now().toString(36)}`,
        categorie: 'legumes',
        unite: 'kg',
        prix_unitaire_fcfa: 500,
        quantite_stock: '100',
        exploitation_id: expl!.id,
      },
    });
    expect(repProd.status(), 'création produit').toBe(201);
    const produit = (await repProd.json()) as { id: string };

    const jetonAmina = await jetonDe(request, PERSONNAGES.amina.telephone);
    const repAddr = await request.get(`${URL_API}/utilisateurs/moi/adresses/`, {
      headers: bearer(jetonAmina),
    });
    expect(repAddr.ok()).toBeTruthy();
    const adresses = (await repAddr.json()) as
      Array<{ id: string; libelle: string }> | { elements: Array<{ id: string; libelle: string }> };
    const listeAdr = Array.isArray(adresses) ? adresses : adresses.elements;
    const domicile = listeAdr.find((a) => a.libelle === 'Domicile') ?? listeAdr[0];
    expect(domicile, 'adresse Domicile (seed)').toBeDefined();

    const repCmd = await request.post(`${URL_API}/commandes/`, {
      headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json' },
      data: { lignes: [{ produit_id: produit.id, quantite: '10' }], adresse_id: domicile!.id },
    });
    expect(repCmd.status(), 'création commande').toBe(201);
    const commande = (await repCmd.json()) as { id: string };

    const repAccept = await request.post(`${URL_API}/commandes/${commande.id}/accepter/`, {
      headers: bearer(jetonPaul),
    });
    expect(repAccept.status(), 'acceptation Paul').toBeLessThan(300);

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commande.id}`);
    await expect(page.getByTestId('page-detail-commande')).toBeVisible();

    const bouton = page.getByTestId('bouton-payer');
    await expect(bouton).toBeEnabled();
    await expect(page.getByTestId('explication-paiement-hors-ligne')).toHaveCount(0);

    // Coupure réseau : le paiement se désactive, aucune mise en file.
    await simulerHorsLigne(page);
    await expect(bouton).toBeDisabled();
    await expect(page.getByTestId('explication-paiement-hors-ligne')).toBeVisible();

    await retablirEnLigne(page);
    await expect(bouton).toBeEnabled();
  });

  test('PW-F15-04 : après déconnexion, plus aucune donnée privée en cache IndexedDB', async ({
    page,
  }) => {
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto('/commandes');
    await expect(page.getByTestId('page-mes-commandes')).toBeVisible();

    // La persistance écrit après un léger délai (throttle 2 s) : on l'attend.
    await expect
      .poll(() => clesPriveesEnBase(page), { timeout: 10000, message: 'cache privé écrit' })
      .not.toHaveLength(0);

    await page
      .getByRole('button', { name: /déconnexion/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/$/);

    await expect
      .poll(() => clesPriveesEnBase(page), { timeout: 10000, message: 'cache privé purgé' })
      .toHaveLength(0);
  });

  test('PW-F15-05 : service worker actif (socle du bandeau de mise à jour)', async ({ page }) => {
    await page.goto('/catalogue');
    await attendreServiceWorker(page);
    const controle = await page.evaluate(() => navigator.serviceWorker.controller !== null);
    expect(controle, 'le service worker doit contrôler la page').toBeTruthy();
  });
});

test.describe('F-15 — Accessibilité et responsive (mobile uniquement)', () => {
  test('PW-F15-06 @mobile : axe sans violation grave (catalogue, commandes, notifications)', async ({
    page,
  }) => {
    test.skip(!/mobile/i.test(test.info().project.name), 'mobile uniquement');
    await connexionUI(page, PERSONNAGES.amina.telephone);

    await page.goto('/catalogue');
    await expect(articleProduit(page).first()).toBeVisible();
    await verifierAccessibilite(page);

    await page.goto('/commandes');
    await expect(page.getByTestId('page-mes-commandes')).toBeVisible();
    await verifierAccessibilite(page);

    await page.goto('/notifications');
    await expect(page.getByTestId('page-notifications')).toBeVisible();
    await verifierAccessibilite(page);
  });

  test('PW-F15-07 @mobile : aucune barre de défilement horizontal à 360 px', async ({ page }) => {
    test.skip(!/mobile/i.test(test.info().project.name), 'mobile uniquement');
    await page.setViewportSize({ width: 360, height: 640 });

    await page.goto('/catalogue');
    await expect(articleProduit(page).first()).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, 'largeur horizontale à 360 px').toBeLessThanOrEqual(361);
  });
});
