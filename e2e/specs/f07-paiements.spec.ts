/**
 * E2E F-07 — Paiements NotchPay (docs/12-plan-tests-playwright.md §2).
 * Règles §1.4 : rôles/libellés d'abord, aucune attente fixe, données uniques
 * par test, identifiant dans chaque titre, double vérification écran + API.
 * Le simulateur local remplace NotchPay ; les webhooks directs passent par
 * `e2e/utils/notchpay.ts` (signature HMAC réelle).
 */
import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { verifierAccessibilite } from '../utils/a11y';
import { envoyerWebhook, evenementReussi } from '../utils/notchpay';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';

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

async function adresseAmina(page: Page, jeton: string, libelle: string): Promise<string> {
  const reponse = await page.request.get(`${URL_API}/utilisateurs/moi/adresses/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  const corps = (await reponse.json()) as
    | Array<{ id: string; libelle: string }>
    | { elements: Array<{ id: string; libelle: string }> };
  const liste = Array.isArray(corps) ? corps : corps.elements;
  const adresse = liste.find((a) => a.libelle === libelle);
  expect(adresse, `adresse ${libelle} requise (seed)`).toBeDefined();
  return adresse!.id;
}

/** Commande acceptée de 10 kg (produit unique), prête à payer. */
async function commandePreteAPayer(
  page: Page,
  suffixe: string
): Promise<{ commandeId: string; produitId: string; jetonPaul: string; jetonAmina: string }> {
  const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
  const exploitationId = await exploitationDePaul(page, jetonPaul);
  const nom = `Tomates Pay E2E-${suffixe}`;
  const creation = await page.request.post(`${URL_API}/produits/`, {
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
  expect(creation.status()).toBe(201);
  const produitId = ((await creation.json()) as { id: string }).id;

  const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
  const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');
  const commande = await page.request.post(`${URL_API}/commandes/`, {
    headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json' },
    data: { lignes: [{ produit_id: produitId, quantite: '10' }], adresse_id: domicileId },
  });
  expect(commande.status()).toBe(201);
  const commandeId = ((await commande.json()) as { id: string }).id;
  const acceptation = await page.request.post(`${URL_API}/commandes/${commandeId}/accepter/`, {
    headers: bearer(jetonPaul),
  });
  expect(acceptation.ok()).toBeTruthy();
  return { commandeId, produitId, jetonPaul, jetonAmina };
}

async function statutCommande(
  page: Page,
  jeton: string,
  commandeId: string
): Promise<string> {
  const reponse = await page.request.get(`${URL_API}/commandes/${commandeId}/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  return ((await reponse.json()) as { statut: string }).statut;
}

test.describe('F-07 — Paiements NotchPay', () => {
  test.afterEach(async ({ clientApi }) => {
    await clientApi.reinitialiserHorloge();
  });

  test('PW-F07-01 @critique Amina paie au simulateur ; en cours avant webhook, payée après', async ({
    page,
  }) => {
    const { commandeId, jetonPaul, jetonAmina } = await commandePreteAPayer(page, suffixeUnique());

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commandeId}`);
    await expect(page.getByTestId('section-paiement')).toBeVisible();
    await verifierAccessibilite(page);
    await page.getByTestId('selecteur-operateur').selectOption('mtn_momo');
    await page.getByLabel(/Numéro à débiter/).fill('+237690000002');
    await page.getByRole('button', { name: /Payer 6/ }).click();

    // Redirection vers le simulateur local (montant rappelé).
    await expect(page).toHaveURL(/simulateur/);
    await expect(page.getByText('6400 FCFA')).toBeVisible();
    const lienRetour = await page.getByRole('link', { name: /Retour à AgriSens/ }).getAttribute('href');
    expect(lienRetour).toContain('/paiements/retour?paiement=');
    const paiementId = new URL(lienRetour!, 'http://127.0.0.1:4173').searchParams.get('paiement');
    expect(paiementId).toBeTruthy();

    // Avant le webhook : l'écran de retour affiche « en cours de vérification ».
    const pageRetour = await nouvellePage(page.context());
    await connexionUI(pageRetour, PERSONNAGES.amina.telephone);
    await pageRetour.goto(lienRetour!);
    await expect(pageRetour.getByRole('heading', { name: 'Paiement en cours de vérification' })).toBeVisible();
    expect(await statutCommande(page, jetonAmina, commandeId)).toBe('paiement_en_attente');

    // Clic « réussi » au simulateur → webhook signé → payée des deux côtés.
    await page.getByRole('button', { name: 'Paiement réussi' }).click();
    await expect(page.getByText(/traité/)).toBeVisible();
    await expect(pageRetour.getByRole('heading', { name: 'Paiement réussi' })).toBeVisible({ timeout: 15000 });

    await page.goto(`/commandes/${commandeId}`);
    await expect(page.getByTestId('page-detail-commande')).toContainText('Payée');
    expect(await statutCommande(page, jetonAmina, commandeId)).toBe('payee');

    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/agriculteur/commandes/${commandeId}`);
    await expect(pagePaul.getByTestId('page-detail-commande')).toContainText('Payée');

    // Commission figée : 5 % de 5 000 = 250 FCFA.
    const detail = (await (
      await page.request.get(`${URL_API}/commandes/${commandeId}/`, { headers: bearer(jetonPaul) })
    ).json()) as { commission_taux_pb: number; commission_fcfa: number };
    expect(detail.commission_taux_pb).toBe(500);
    expect(detail.commission_fcfa).toBe(250);
    await pageRetour.context().close();
    await pagePaul.context().close();
  });

  test('PW-F07-02 @critique Webhook rejoué : un seul paiement réussi, sans doublon', async ({
    page,
  }) => {
    const { commandeId, jetonAmina } = await commandePreteAPayer(page, suffixeUnique());
    const init = await page.request.post(`${URL_API}/commandes/${commandeId}/paiements/`, {
      headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json', 'Idempotency-Key': `e2e-f07-02-${suffixeUnique()}` },
      data: { operateur: 'mtn_momo' },
    });
    expect(init.status()).toBe(201);
    const corps = (await init.json()) as { reference_interne: string; montant_fcfa: number };

    const evenement = evenementReussi(corps.reference_interne, corps.montant_fcfa, 'rejouable');
    const premier = await envoyerWebhook(page.request, evenement);
    expect(premier.status()).toBe(200);
    const second = await envoyerWebhook(page.request, evenement);
    expect(second.status()).toBe(200);
    expect(((await second.json()) as { statut: string }).statut).toBe('deja_traite');

    expect(await statutCommande(page, jetonAmina, commandeId)).toBe('payee');
  });

  test('PW-F07-03 Paiement échoué : message clair, second essai réussi', async ({ page }) => {
    const { commandeId } = await commandePreteAPayer(page, suffixeUnique());
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commandeId}`);
    await page.getByRole('button', { name: /Payer 6/ }).click();
    await expect(page).toHaveURL(/simulateur/);

    await page.getByRole('button', { name: 'Paiement échoué' }).click();
    await expect(page.getByText(/traité/)).toBeVisible();
    const lienRetour = await page.getByRole('link', { name: /Retour à AgriSens/ }).getAttribute('href');
    await page.goto(lienRetour!);
    await expect(page.getByRole('heading', { name: 'Paiement échoué' })).toBeVisible({ timeout: 15000 });

    // Nouvel essai depuis la commande, cette fois réussi.
    await page.getByRole('link', { name: 'Réessayer depuis la commande' }).click();
    await expect(page).toHaveURL(`/commandes/${commandeId}`);
    await page.getByRole('button', { name: /Payer 6/ }).click();
    await expect(page).toHaveURL(/simulateur/);
    await page.getByRole('button', { name: 'Paiement réussi' }).click();
    await expect(page.getByText(/traité/)).toBeVisible();
    const lienRetour2 = await page.getByRole('link', { name: /Retour à AgriSens/ }).getAttribute('href');
    await page.goto(lienRetour2!);
    await expect(page.getByRole('heading', { name: 'Paiement réussi' })).toBeVisible({ timeout: 15000 });
  });

  test('PW-F07-04 Webhook à signature invalide : 401, commande non payée', async ({ page }) => {
    const { commandeId, jetonAmina } = await commandePreteAPayer(page, suffixeUnique());
    const init = await page.request.post(`${URL_API}/commandes/${commandeId}/paiements/`, {
      headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json', 'Idempotency-Key': `e2e-f07-04-${suffixeUnique()}` },
      data: { operateur: 'orange_money' },
    });
    expect(init.status()).toBe(201);
    const corps = (await init.json()) as { reference_interne: string; montant_fcfa: number };

    const reponse = await envoyerWebhook(
      page.request,
      evenementReussi(corps.reference_interne, corps.montant_fcfa, 'faux'),
      'mauvaise-signature'
    );
    expect(reponse.status()).toBe(401);
    expect(await statutCommande(page, jetonAmina, commandeId)).toBe('paiement_en_attente');
  });

  test("PW-F07-05 Double init même clé : un seul paiement (double-clic sans doublon)", async ({
    page,
  }) => {
    const suffixe = suffixeUnique();
    // Cœur déterministe (API) : deux inits même clé → même paiement.
    const premiere = await commandePreteAPayer(page, `${suffixe}-a`);
    const corpsInit = {
      headers: { ...bearer(premiere.jetonAmina), 'Content-Type': 'application/json', 'Idempotency-Key': `e2e-f07-05-${suffixe}` },
      data: { operateur: 'mtn_momo' },
    };
    const init1 = await page.request.post(
      `${URL_API}/commandes/${premiere.commandeId}/paiements/`,
      corpsInit
    );
    expect(init1.status()).toBe(201);
    const init2 = await page.request.post(
      `${URL_API}/commandes/${premiere.commandeId}/paiements/`,
      corpsInit
    );
    expect(init2.status()).toBe(200);
    expect(((await init2.json()) as { id: string }).id).toBe(
      ((await init1.json()) as { id: string }).id
    );

    // Double-clic UI : le bouton se désactive pendant l'appel, une seule
    // navigation (l'unicité est garantie par la clé testée ci-dessus).
    const seconde = await commandePreteAPayer(page, `${suffixe}-b`);
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${seconde.commandeId}`);
    await page.getByRole('button', { name: /Payer 6/ }).click();
    await expect(page).toHaveURL(/simulateur/);
  });

  test('PW-F07-06 Onglet fermé pendant le paiement : statut correct relu depuis l’API', async ({
    page,
  }) => {
    const { commandeId, jetonAmina } = await commandePreteAPayer(page, suffixeUnique());
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commandeId}`);
    await page.getByRole('button', { name: /Payer 6/ }).click();
    await expect(page).toHaveURL(/simulateur/);

    // Fermeture sans valider au simulateur : aucun webhook, rien ne change.
    const page2 = await nouvellePage(page.context());
    await connexionUI(page2, PERSONNAGES.amina.telephone);
    await page2.goto(`/commandes/${commandeId}`);
    await expect(page2.getByTestId('page-detail-commande')).toContainText('Paiement en cours de vérification');
    expect(await statutCommande(page, jetonAmina, commandeId)).toBe('paiement_en_attente');
    await page2.context().close();
  });

  test('PW-F07-07 Tâche verifier_paiements sur un paiement non confirmé : sans casse', async ({
    page,
    clientApi,
  }) => {
    const { commandeId, jetonAmina } = await commandePreteAPayer(page, suffixeUnique());
    await page.request.post(`${URL_API}/commandes/${commandeId}/paiements/`, {
      headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json', 'Idempotency-Key': `e2e-f07-07-${suffixeUnique()}` },
      data: { operateur: 'mtn_momo' },
    });

    // Sans webhook, la tâche tourne sans effet : le paiement reste en attente.
    await clientApi.declencherTache('verifier_paiements');
    expect(await statutCommande(page, jetonAmina, commandeId)).toBe('paiement_en_attente');

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commandeId}`);
    await expect(page.getByTestId('page-detail-commande')).toContainText('Paiement en cours de vérification');
  });
});
