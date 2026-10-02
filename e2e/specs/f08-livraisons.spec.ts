/**
 * E2E F-08 — Livraisons, itinéraire et code de remise
 * (docs/12-plan-tests-playwright.md §2).
 * Règles §1.4 : rôles/libellés d'abord, aucune attente fixe, données uniques
 * par test, identifiant dans chaque titre, double vérification écran + API.
 */
import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { verifierAccessibilite } from '../utils/a11y';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';
const POINT_YAOUNDE = { type: 'Point', coordinates: [11.5137, 3.848] };
const TELEPHONE_ALAIN = '+237690000007';

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

function bearer(jeton: string): Record<string, string> {
  return { Authorization: `Bearer ${jeton}` };
}

async function connexionApiAvecJeton(page: Page, identifiant: string): Promise<string> {
  const reponse = await page.request.post(`${URL_API}/auth/connexion/`, {
    data: { identifiant, mot_de_passe: MOT_DE_PASSE },
  });
  expect(reponse.ok(), 'la connexion API doit réussir').toBeTruthy();
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

async function nouvellePage(
  contexteParent: import('@playwright/test').BrowserContext
): Promise<Page> {
  const navigateur = contexteParent.browser();
  const contexte = await navigateur!.newContext({
    baseURL: 'http://127.0.0.1:4173',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  });
  return contexte.newPage();
}

async function exploitationDePaul(page: Page, jeton: string): Promise<string> {
  const reponse = await page.request.get(`${URL_API}/exploitations/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  const liste = (await reponse.json()) as Array<{ id: string; nom: string }>;
  const champ = liste.find((e) => e.nom === 'Champ Nord') ?? liste[0];
  expect(champ, 'exploitation requise').toBeDefined();
  return champ!.id;
}

async function adresseAmina(page: Page, jeton: string): Promise<string> {
  const reponse = await page.request.get(`${URL_API}/utilisateurs/moi/adresses/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  const corps = (await reponse.json()) as
    | Array<{ id: string; libelle: string }>
    | { elements: Array<{ id: string; libelle: string }> };
  const liste = Array.isArray(corps) ? corps : corps.elements;
  const adresse = liste.find((a) => a.libelle === 'Domicile');
  expect(adresse, 'adresse Domicile requise (seed)').toBeDefined();
  return adresse!.id;
}

interface CoursePrete {
  commandeId: string;
  produitId: string;
  livraisonId: string;
  jetonPaul: string;
  jetonAmina: string;
  jetonJean: string;
}

/** Commande payée (webhook direct) : livraison `proposee`. */
async function commandePayee(page: Page, suffixe: string): Promise<CoursePrete> {
  const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
  const exploitationId = await exploitationDePaul(page, jetonPaul);
  const nom = `Tomates Liv E2E-${suffixe}`;
  const produit = await page.request.post(`${URL_API}/produits/`, {
    headers: { ...bearer(jetonPaul), 'Content-Type': 'application/json' },
    data: {
      nom,
      categorie: 'legumes',
      unite: 'kg',
      prix_unitaire_fcfa: 500,
      quantite_stock: '100',
      exploitation_id: exploitationId,
    },
  });
  expect(produit.status()).toBe(201);
  const produitId = ((await produit.json()) as { id: string }).id;

  const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
  const domicileId = await adresseAmina(page, jetonAmina);
  const commande = await page.request.post(`${URL_API}/commandes/`, {
    headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json' },
    data: { lignes: [{ produit_id: produitId, quantite: '10' }], adresse_id: domicileId },
  });
  expect(commande.status()).toBe(201);
  const commandeId = ((await commande.json()) as { id: string }).id;

  const acceptation = await page.request.post(
    `${URL_API}/commandes/${commandeId}/accepter/`,
    { headers: bearer(jetonPaul) }
  );
  expect(acceptation.ok()).toBeTruthy();

  const init = await page.request.post(`${URL_API}/commandes/${commandeId}/paiements/`, {
    headers: {
      ...bearer(jetonAmina),
      'Content-Type': 'application/json',
      'Idempotency-Key': `e2e-f08-${suffixe}`,
    },
    data: { operateur: 'mtn_momo' },
  });
  expect(init.status()).toBe(201);
  const initJson = (await init.json()) as { reference_interne: string; montant_fcfa: number };

  const { envoyerWebhook, evenementReussi } = await import('../utils/notchpay');
  const webhook = await envoyerWebhook(
    page.request,
    evenementReussi(initJson.reference_interne, initJson.montant_fcfa, `f08-${suffixe}`)
  );
  expect(webhook.status()).toBe(200);

  const livraison = await page.request.get(`${URL_API}/commandes/${commandeId}/livraison/`, {
    headers: bearer(jetonAmina),
  });
  expect(livraison.status()).toBe(200);
  const livraisonId = ((await livraison.json()) as { id: string }).id;

  const jetonJean = await connexionApiAvecJeton(page, PERSONNAGES.jean.telephone);
  return { commandeId, produitId, livraisonId, jetonPaul, jetonAmina, jetonJean };
}

async function rendreDisponible(page: Page, jeton: string, disponible: boolean): Promise<void> {
  const reponse = await page.request.put(`${URL_API}/livreurs/moi/disponibilite/`, {
    headers: { ...bearer(jeton), 'Content-Type': 'application/json' },
    data: disponible
      ? { disponible: true, position: POINT_YAOUNDE, zone: 'centre' }
      : { disponible: false },
  });
  expect(reponse.ok()).toBeTruthy();
}

async function statutLivraison(
  page: Page,
  jeton: string,
  livraisonId: string
): Promise<string> {
  const reponse = await page.request.get(`${URL_API}/livraisons/${livraisonId}/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  return ((await reponse.json()) as { statut: string }).statut;
}

test.describe('F-08 — Livraisons, itinéraire et code de remise', () => {
  test.afterEach(async ({ page }) => {
    // La base E2E est partagée : on remet Jean indisponible (état du seed)
    // pour ne pas polluer les scénarios des autres features (PW-F03-09).
    const jetonJean = await connexionApiAvecJeton(page, PERSONNAGES.jean.telephone);
    await rendreDisponible(page, jetonJean, false);
  });

  test('PW-F08-01 @critique Jean accepte, démarre, mauvais code refusé, bon code livré', async ({
    page,
  }) => {
    const course = await commandePayee(page, suffixeUnique());
    await rendreDisponible(page, course.jetonJean, true);

    // Jean voit la livraison SANS adresse exacte ni téléphone (API).
    const disponibles = await page.request.get(`${URL_API}/livraisons/disponibles/`, {
      headers: bearer(course.jetonJean),
    });
    expect(disponibles.ok()).toBeTruthy();
    const elements = (await disponibles.json()) as Array<Record<string, unknown>>;
    expect(elements.length).toBeGreaterThanOrEqual(1);
    const moi = elements.find((e) => e.commande_reference !== undefined);
    expect(JSON.stringify(moi)).not.toContain('+237');

    // Jean accepte depuis LIV-02.
    await connexionUI(page, PERSONNAGES.jean.telephone);
    await page.goto('/livreur/courses');
    await expect(page.getByTestId('page-courses-livreur')).toBeVisible();
    await verifierAccessibilite(page);
    const carte = page.getByRole('article', { name: /Livraison CMD-/ }).first();
    await carte.getByRole('button', { name: 'Accepter' }).click();
    await expect(page.getByRole('link', { name: /CMD-/ }).first()).toBeVisible();

    // Itinéraire visible sur LIV-03 ; Paul prépare ; Jean démarre.
    const pageJean = page;
    await pageJean.goto(`/livreur/courses/${course.livraisonId}`);
    await expect(pageJean.getByTestId('carte-course')).toBeVisible();
    await verifierAccessibilite(pageJean);
    const preparer = await page.request.post(
      `${URL_API}/commandes/${course.commandeId}/preparer/`,
      { headers: bearer(course.jetonPaul) }
    );
    expect(preparer.ok()).toBeTruthy();
    await pageJean.getByRole('button', { name: /Démarrer/ }).click();
    await expect(pageJean.getByTestId('page-course-livreur')).toContainText('en_cours');

    // Mauvais code refusé.
    await pageJean.getByLabel(/Code de remise/).fill('000000');
    await pageJean.getByRole('button', { name: 'Valider' }).click();
    await expect(pageJean.getByRole('alert')).toContainText(/incorrect/i);

    // Le code d'Amina valide la remise : livrée pour les trois.
    const pageAmina = await nouvellePage(page.context());
    await connexionUI(pageAmina, PERSONNAGES.amina.telephone);
    await pageAmina.goto(`/commandes/${course.commandeId}`);
    const code = await pageAmina.getByTestId('code-remise').textContent();
    expect(code?.trim()).toMatch(/^[0-9]{6}$/);
    await pageAmina.context().close();

    await pageJean.getByLabel(/Code de remise/).fill(code!.trim());
    await pageJean.getByRole('button', { name: 'Valider' }).click();
    await expect(pageJean.getByTestId('page-course-livreur')).toContainText('livree');

    expect(await statutLivraison(page, course.jetonJean, course.livraisonId)).toBe('livree');
    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/agriculteur/commandes/${course.commandeId}`);
    await expect(pagePaul.getByTestId('page-detail-commande')).toContainText('Livrée');
    await pagePaul.context().close();
  });

  test('PW-F08-02 Deux livreurs acceptent en même temps : un seul gagne (409)', async ({
    page,
  }) => {
    const course = await commandePayee(page, suffixeUnique());
    await rendreDisponible(page, course.jetonJean, true);
    const jetonAlain = await connexionApiAvecJeton(page, TELEPHONE_ALAIN);
    await rendreDisponible(page, jetonAlain, true);

    const [r1, r2] = await Promise.all([
      page.request.post(`${URL_API}/livraisons/${course.livraisonId}/accepter/`, {
        headers: bearer(course.jetonJean),
      }),
      page.request.post(`${URL_API}/livraisons/${course.livraisonId}/accepter/`, {
        headers: bearer(jetonAlain),
      }),
    ]);
    expect([r1.status(), r2.status()].sort()).toEqual([200, 409]);
    expect(
      [await r1.json(), await r2.json()].some(
        (c) => (c as { erreur?: { code?: string } }).erreur?.code === 'livraison_deja_prise'
      )
    ).toBe(true);
  });

  test('PW-F08-03 @critique Client absent : pas livrée, Amina reprogramme et paie, proposée', async ({
    page,
  }) => {
    const course = await commandePayee(page, suffixeUnique());
    await rendreDisponible(page, course.jetonJean, true);
    const acceptation = await page.request.post(
      `${URL_API}/livraisons/${course.livraisonId}/accepter/`,
      { headers: bearer(course.jetonJean) }
    );
    expect(acceptation.ok()).toBeTruthy();
    const preparation = await page.request.post(
      `${URL_API}/commandes/${course.commandeId}/preparer/`,
      { headers: bearer(course.jetonPaul) }
    );
    expect(preparation.ok()).toBeTruthy();
    const demarrage = await page.request.post(
      `${URL_API}/livraisons/${course.livraisonId}/demarrer/`,
      { headers: bearer(course.jetonJean) }
    );
    expect(demarrage.ok()).toBeTruthy();

    // Jean déclare « client absent » depuis LIV-03.
    await connexionUI(page, PERSONNAGES.jean.telephone);
    await page.goto(`/livreur/courses/${course.livraisonId}`);
    await page.getByTestId('selecteur-type-incident').selectOption('client_absent');
    await page.getByLabel(/Description de l’incident/).fill('Personne au portail, rappelé deux fois.');
    await page.getByRole('button', { name: 'Signaler l’incident' }).click();
    await expect(page.getByText('Incident déclaré.')).toBeVisible();
    expect(await statutLivraison(page, course.jetonJean, course.livraisonId)).toBe('client_absent');

    // Amina voit l'incident, reprogramme et paie les nouveaux frais.
    const pageAmina = await nouvellePage(page.context());
    await connexionUI(pageAmina, PERSONNAGES.amina.telephone);
    await pageAmina.goto(`/commandes/${course.commandeId}`);
    await expect(pageAmina.getByTestId('suivi-livraison')).toContainText(/absent/i);
    await pageAmina.getByRole('button', { name: /Reprogrammer et payer/ }).click();
    await expect(pageAmina).toHaveURL(/simulateur/);
    await pageAmina.getByRole('button', { name: 'Paiement réussi' }).click();
    await expect(pageAmina.getByText(/traité/)).toBeVisible();
    const lienRetour = await pageAmina
      .getByRole('link', { name: /Retour à AgriSens/ })
      .getAttribute('href');
    await pageAmina.goto(lienRetour!);
    await expect(pageAmina.getByRole('heading', { name: 'Paiement réussi' })).toBeVisible({
      timeout: 15000,
    });

    expect(await statutLivraison(page, course.jetonPaul, course.livraisonId)).toBe('proposee');
    const detail = (await (
      await page.request.get(`${URL_API}/livraisons/${course.livraisonId}/`, {
        headers: bearer(course.jetonPaul),
      })
    ).json()) as { numero_tentative: number };
    expect(detail.numero_tentative).toBe(2);
    await pageAmina.context().close();
  });

  test('PW-F08-04 Échec de livraison : reprogrammation sans frais', async ({ page }) => {
    const course = await commandePayee(page, suffixeUnique());
    await rendreDisponible(page, course.jetonJean, true);
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/accepter/`, {
      headers: bearer(course.jetonJean),
    });
    await page.request.post(`${URL_API}/commandes/${course.commandeId}/preparer/`, {
      headers: bearer(course.jetonPaul),
    });
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/demarrer/`, {
      headers: bearer(course.jetonJean),
    });
    const incident = await page.request.post(
      `${URL_API}/livraisons/${course.livraisonId}/incidents/`,
      {
        headers: { ...bearer(course.jetonJean), 'Content-Type': 'application/json' },
        data: { type: 'echec_livraison', description: 'Piste impraticable.' },
      }
    );
    expect(incident.status()).toBe(201);

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${course.commandeId}`);
    await page.getByRole('button', { name: /Reprogrammer sans frais/ }).click();
    await expect(page.getByTestId('suivi-livraison')).toContainText(/proposée|en attente|Proposée/i);
    expect(await statutLivraison(page, course.jetonPaul, course.livraisonId)).toBe('proposee');
  });

  test('PW-F08-05 Cinq codes faux : saisie bloquée, intervention admin', async ({ page }) => {
    const course = await commandePayee(page, suffixeUnique());
    await rendreDisponible(page, course.jetonJean, true);
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/accepter/`, {
      headers: bearer(course.jetonJean),
    });
    await page.request.post(`${URL_API}/commandes/${course.commandeId}/preparer/`, {
      headers: bearer(course.jetonPaul),
    });
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/demarrer/`, {
      headers: bearer(course.jetonJean),
    });

    await connexionUI(page, PERSONNAGES.jean.telephone);
    await page.goto(`/livreur/courses/${course.livraisonId}`);
    for (let i = 0; i < 5; i += 1) {
      await page.getByLabel(/Code de remise/).fill('000000');
      await page.getByRole('button', { name: 'Valider' }).click();
      await expect(page.getByRole('alert')).toContainText(/incorrect/i);
    }
    await page.getByLabel(/Code de remise/).fill('000000');
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByRole('alert')).toContainText(/administrateur/i);
  });

  test('PW-F08-06 Téléphone de Jean visible seulement pendant la course', async ({ page }) => {
    const course = await commandePayee(page, suffixeUnique());
    await rendreDisponible(page, course.jetonJean, true);
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/accepter/`, {
      headers: bearer(course.jetonJean),
    });
    await page.request.post(`${URL_API}/commandes/${course.commandeId}/preparer/`, {
      headers: bearer(course.jetonPaul),
    });
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/demarrer/`, {
      headers: bearer(course.jetonJean),
    });

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${course.commandeId}`);
    await expect(page.getByTestId('suivi-livraison')).toContainText('+237');

    // Après livraison, le téléphone disparaît.
    const code = await page.getByTestId('code-remise').textContent();
    const pageJean = await nouvellePage(page.context());
    await connexionUI(pageJean, PERSONNAGES.jean.telephone);
    await pageJean.goto(`/livreur/courses/${course.livraisonId}`);
    await pageJean.getByLabel(/Code de remise/).fill(code!.trim());
    await pageJean.getByRole('button', { name: 'Valider' }).click();
    await expect(pageJean.getByTestId('page-course-livreur')).toContainText('livree');
    await pageJean.context().close();

    await page.goto(`/commandes/${course.commandeId}`);
    await expect(page.getByTestId('suivi-livraison')).not.toContainText('+237');
  });

  test('PW-F08-07 Jean indisponible : aucune livraison proposée', async ({ page }) => {
    await commandePayee(page, suffixeUnique());
    const jetonJean = await connexionApiAvecJeton(page, PERSONNAGES.jean.telephone);
    await rendreDisponible(page, jetonJean, false);

    await connexionUI(page, PERSONNAGES.jean.telephone);
    await page.goto('/livreur/courses');
    await expect(page.getByText('Aucune livraison proposée')).toBeVisible();
  });

  test('PW-F08-08 Bouton navigation : lien valide vers la destination', async ({ page }) => {
    const course = await commandePayee(page, suffixeUnique());
    await rendreDisponible(page, course.jetonJean, true);
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/accepter/`, {
      headers: bearer(course.jetonJean),
    });

    await connexionUI(page, PERSONNAGES.jean.telephone);
    await page.goto(`/livreur/courses/${course.livraisonId}`);
    const href = await page
      .getByRole('link', { name: /Ouvrir dans la navigation/ })
      .getAttribute('href');
    expect(href).toContain('https://www.google.com/maps/dir/');
    expect(href).toContain('destination=');
  });

  test('PW-F08-09 Mobile : LIV-03 utilisable d’une main', async ({ page }) => {
    const course = await commandePayee(page, suffixeUnique());
    await rendreDisponible(page, course.jetonJean, true);
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/accepter/`, {
      headers: bearer(course.jetonJean),
    });

    await connexionUI(page, PERSONNAGES.jean.telephone);
    await page.goto(`/livreur/courses/${course.livraisonId}`);
    const bouton = page.getByRole('button', { name: /Démarrer/ });
    await expect(bouton).toBeVisible();
    const boite = await bouton.boundingBox();
    const vue = page.viewportSize();
    expect(boite).not.toBeNull();
    expect(vue).not.toBeNull();
    expect(boite!.y + boite!.height).toBeLessThanOrEqual(vue!.height);
  });
});
