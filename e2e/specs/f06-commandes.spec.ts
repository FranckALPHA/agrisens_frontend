/**
 * E2E F-06 — Commandes (docs/12-plan-tests-playwright.md §2).
 * Règles §1.4 : rôles/libellés d'abord, aucune attente fixe, données uniques
 * par test (produits créés via l'API), identifiant dans chaque titre,
 * double vérification écran + API pour les règles critiques.
 */
import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { verifierAccessibilite } from '../utils/a11y';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';
const POLYGONE_YAOUNDE = {
  type: 'Polygon',
  coordinates: [
    [
      [11.5, 3.84],
      [11.51, 3.84],
      [11.51, 3.85],
      [11.5, 3.85],
      [11.5, 3.84],
    ],
  ],
};

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

function telephoneNeuf(): string {
  return `+2376${Math.floor(90000000 + Math.random() * 9999999)}`;
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

interface ProduitCree {
  id: string;
  nom: string;
}

async function exploitationDe(
  page: Page,
  jeton: string,
  nomExploitation = 'Champ Nord'
): Promise<string> {
  const reponse = await page.request.get(`${URL_API}/exploitations/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  const liste = (await reponse.json()) as Array<{ id: string; nom: string }>;
  const champ = liste.find((e) => e.nom === nomExploitation) ?? liste[0];
  expect(champ, 'exploitation requise').toBeDefined();
  return champ!.id;
}

async function creerProduitApi(
  page: Page,
  jeton: string,
  exploitationId: string,
  nom: string,
  quantite = '100',
  prix = 500
): Promise<ProduitCree> {
  const reponse = await page.request.post(`${URL_API}/produits/`, {
    headers: { ...bearer(jeton), 'Content-Type': 'application/json' },
    data: {
      nom,
      categorie: 'legumes',
      unite: 'kg',
      prix_unitaire_fcfa: prix,
      quantite_stock: quantite,
      exploitation_id: exploitationId,
    },
  });
  expect(reponse.status(), 'création produit').toBe(201);
  return { id: ((await reponse.json()) as { id: string }).id, nom };
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

async function creerCommandeApi(
  page: Page,
  jetonAcheteur: string,
  produitId: string,
  adresseId: string,
  quantite = '10'
): Promise<{ id: string; reference: string }> {
  const reponse = await page.request.post(`${URL_API}/commandes/`, {
    headers: { ...bearer(jetonAcheteur), 'Content-Type': 'application/json' },
    data: { lignes: [{ produit_id: produitId, quantite }], adresse_id: adresseId },
  });
  expect(reponse.status(), 'création commande').toBe(201);
  return (await reponse.json()) as { id: string; reference: string };
}

async function stockProduit(
  page: Page,
  jeton: string,
  produitId: string
): Promise<{ reservee: string; stock: string; statut: string }> {
  const reponse = await page.request.get(`${URL_API}/produits/${produitId}/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  const corps = (await reponse.json()) as {
    quantite_reservee: string;
    quantite_stock: string;
    statut: string;
  };
  return { reservee: corps.quantite_reservee, stock: corps.quantite_stock, statut: corps.statut };
}

test.describe('F-06 — Commandes', () => {
  test.afterEach(async ({ clientApi }) => {
    await clientApi.reinitialiserHorloge();
  });

  test('PW-F06-01 @critique Amina commande 10 kg, Paul accepte, stock réservé, statuts visibles', async ({
    page,
  }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const nom = `Tomates E2E-${suffixeUnique()}`;
    const produit = await creerProduitApi(page, jetonPaul, exploitationId, nom);
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');

    // Amina : catalogue → détail → panier (10 kg).
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/catalogue/${produit.id}`);
    await page.getByLabel(/Quantité/).fill('10');
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await expect(page.getByText('Ajouté au panier.')).toBeVisible();

    // Panier : adresse à 6 km → frais 1 400 FCFA, total 6 400 FCFA.
    await page.goto('/panier');
    await expect(page.getByTestId('page-panier')).toBeVisible();
    await verifierAccessibilite(page);
    await page.getByTestId('selecteur-adresse').selectOption(domicileId);
    await expect(page.getByTestId('panier-frais')).toContainText('1');
    await expect(page.getByTestId('panier-frais')).toContainText('400');
    await expect(page.getByTestId('panier-total')).toContainText('6');
    await expect(page.getByTestId('panier-total')).toContainText('400');

    // Confirmation → commande « en attente d'acceptation ».
    await page.getByRole('button', { name: 'Continuer vers la confirmation' }).click();
    await expect(page).toHaveURL('/commandes/confirmation');
    await page.getByRole('button', { name: 'Créer la commande' }).click();
    await expect(page).toHaveURL(/\/commandes\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('CMD-');

    // Paul accepte depuis son espace (second contexte).
    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto('/agriculteur/commandes');
    const idCommande = page.url().split('/').pop()!;
    await pagePaul.goto(`/agriculteur/commandes/${idCommande}`);
    await pagePaul.getByRole('button', { name: /Accepter/ }).click();
    await expect(pagePaul.getByTestId('page-detail-commande')).toContainText('Acceptée');

    // Amina voit « acceptée » ; l'API indique 10 kg réservés et 90 disponibles.
    await page.goto(`/commandes/${idCommande}`);
    await expect(page.getByTestId('page-detail-commande')).toContainText('Acceptée');
    const etat = await stockProduit(page, jetonPaul, produit.id);
    expect(etat.reservee).toBe('10.000');
    expect(String(Number(etat.stock) - Number(etat.reservee))).toBe('90');
    await pagePaul.context().close();
  });

  test("PW-F06-02 Produit d'un autre agriculteur : proposition de vider, refus = inchangé", async ({
    page,
  }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationPaul = await exploitationDe(page, jetonPaul);
    const produitPaul = await creerProduitApi(
      page,
      jetonPaul,
      exploitationPaul,
      `PanierA E2E-${suffixeUnique()}`
    );

    // Second agriculteur avec son exploitation et son produit.
    const telephoneB = telephoneNeuf();
    const inscription = await page.request.post(`${URL_API}/auth/inscription/`, {
      data: {
        nom: 'Marie Voisine',
        telephone: telephoneB,
        mot_de_passe: MOT_DE_PASSE,
        role: 'agriculteur',
      },
    });
    expect(inscription.status()).toBe(201);
    const jetonB = ((await inscription.json()) as { jeton_acces: string }).jeton_acces;
    const champB = await page.request.post(`${URL_API}/exploitations/`, {
      headers: { ...bearer(jetonB), 'Content-Type': 'application/json' },
      data: {
        nom: 'Champ B',
        parcelle: POLYGONE_YAOUNDE,
        type_sol: 'sableux',
        region: 'centre',
      },
    });
    expect(champB.status()).toBe(201);
    const produitB = await creerProduitApi(
      page,
      jetonB,
      ((await champB.json()) as { id: string }).id,
      `PanierB E2E-${suffixeUnique()}`
    );

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/catalogue/${produitPaul.id}`);
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await expect(page.getByText('Ajouté au panier.')).toBeVisible();

    await page.goto(`/catalogue/${produitB.id}`);
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await expect(page.getByRole('dialog')).toContainText('autre agriculteur');
    await page.getByRole('button', { name: 'Garder mon panier' }).click();

    await page.goto('/panier');
    await expect(page.getByText(produitPaul.nom, { exact: true })).toBeVisible();
    await expect(page.getByText(produitB.nom, { exact: true })).toHaveCount(0);
  });

  test('PW-F06-03 Quantité supérieure au stock : refusée dans le panier', async ({ page }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const produit = await creerProduitApi(
      page,
      jetonPaul,
      exploitationId,
      `Stock E2E-${suffixeUnique()}`,
      '5'
    );
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/catalogue/${produit.id}`);
    await page.getByLabel(/Quantité/).fill('999');
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await page.goto('/panier');
    await page.getByTestId('selecteur-adresse').selectOption(domicileId);
    await expect(page.getByTestId('recapitulatif-panier')).toContainText(/insuffisant/i);
  });

  test('PW-F06-04 Adresse à plus de 50 km : hors zone, commande impossible', async ({ page }) => {
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const boutiqueId = await adresseAmina(page, jetonAmina, 'Boutique');

    await connexionUI(page, PERSONNAGES.amina.telephone);
    // Produit quelconque au catalogue (seed Tomates) ajouté au panier.
    await page.goto('/catalogue');
    await page.getByRole('article').first().getByRole('link', { name: /Voir/ }).first().click();
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await page.goto('/panier');
    await page.getByTestId('selecteur-adresse').selectOption(boutiqueId);
    await expect(page.getByTestId('recapitulatif-panier')).toContainText(/hors zone/i);
    await expect(
      page.getByRole('button', { name: 'Continuer vers la confirmation' })
    ).toBeDisabled();
  });

  test('PW-F06-05 Paul rejette avec motif : Amina voit le motif, stock inchangé', async ({
    page,
  }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const produit = await creerProduitApi(
      page,
      jetonPaul,
      exploitationId,
      `Rejet E2E-${suffixeUnique()}`
    );
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');
    const commande = await creerCommandeApi(page, jetonAmina, produit.id, domicileId);
    const motif = `Rupture de main d’œuvre ${suffixeUnique()}`;

    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/agriculteur/commandes/${commande.id}`);
    await pagePaul.getByRole('button', { name: 'Rejeter' }).click();
    await expect(pagePaul.getByRole('button', { name: 'Confirmer le rejet' })).toBeDisabled();
    await pagePaul.getByLabel(/Motif du rejet/).fill(motif);
    await pagePaul.getByRole('button', { name: 'Confirmer le rejet' }).click();
    await expect(pagePaul.getByTestId('page-detail-commande')).toContainText('Rejetée');
    await pagePaul.context().close();

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commande.id}`);
    await expect(page.getByTestId('page-detail-commande')).toContainText('Rejetée');
    await expect(page.getByTestId('page-detail-commande')).toContainText(motif);
    const etat = await stockProduit(page, jetonPaul, produit.id);
    expect(etat.reservee).toBe('0.000');
  });

  test('PW-F06-06 Amina annule une commande acceptée : stock libéré', async ({ page }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const produit = await creerProduitApi(
      page,
      jetonPaul,
      exploitationId,
      `Annul E2E-${suffixeUnique()}`
    );
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');
    const commande = await creerCommandeApi(page, jetonAmina, produit.id, domicileId);
    const acceptation = await page.request.post(
      `${URL_API}/commandes/${commande.id}/accepter/`,
      { headers: bearer(jetonPaul) }
    );
    expect(acceptation.ok()).toBeTruthy();

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commande.id}`);
    await page.getByRole('button', { name: 'Annuler la commande' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Annuler la commande' }).click();
    await expect(page.getByTestId('page-detail-commande')).toContainText('Annulée');
    const etat = await stockProduit(page, jetonPaul, produit.id);
    expect(etat.reservee).toBe('0.000');
  });

  test('PW-F06-07 Expiration : commande annulée, notification à Amina', async ({
    page,
    clientApi,
  }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const produit = await creerProduitApi(
      page,
      jetonPaul,
      exploitationId,
      `Expir E2E-${suffixeUnique()}`
    );
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');
    const commande = await creerCommandeApi(page, jetonAmina, produit.id, domicileId);

    // Session UI établie AVANT le décalage : un jeton forgé après décalage
    // porterait un `iat` futur (PyJWT vérifie en temps réel) et serait rejeté.
    await connexionUI(page, PERSONNAGES.amina.telephone);

    await clientApi.decalerHorloge(25 * 60);
    await clientApi.declencherTache('expirer_commandes');

    const lecture = await page.request.get(`${URL_API}/commandes/${commande.id}/`, {
      headers: bearer(jetonAmina),
    });
    expect(((await lecture.json()) as { statut: string }).statut).toBe('annulee');

    // Retour au temps réel avant toute lecture UI (jetons à nouveau valides).
    await clientApi.reinitialiserHorloge();

    await page.goto(`/commandes/${commande.id}`);
    await expect(page.getByTestId('page-detail-commande')).toContainText('Annulée');
    await page.goto('/notifications');
    await expect(page.getByTestId('page-notifications')).toContainText(/annulée/i);
  });

  test("PW-F06-08 Un autre acheteur ouvre la commande d'Amina : introuvable", async ({
    page,
  }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const produit = await creerProduitApi(
      page,
      jetonPaul,
      exploitationId,
      `Prive E2E-${suffixeUnique()}`
    );
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');
    const commande = await creerCommandeApi(page, jetonAmina, produit.id, domicileId);

    const telephoneAutre = telephoneNeuf();
    const inscription = await page.request.post(`${URL_API}/auth/inscription/`, {
      data: {
        nom: 'Autre Acheteur',
        telephone: telephoneAutre,
        mot_de_passe: MOT_DE_PASSE,
        role: 'acheteur',
      },
    });
    expect(inscription.status()).toBe(201);

    await connexionUI(page, telephoneAutre);
    await page.goto(`/commandes/${commande.id}`);
    await expect(page.getByTestId('commande-introuvable')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Commande introuvable' })).toBeVisible();
  });

  test('PW-F06-09 Stock modifié entre panier et validation : avertissement', async ({ page }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const produit = await creerProduitApi(
      page,
      jetonPaul,
      exploitationId,
      `Alerte E2E-${suffixeUnique()}`,
      '100'
    );

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/catalogue/${produit.id}`);
    await page.getByLabel(/Quantité/).fill('10');
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await expect(page.getByText('Ajouté au panier.')).toBeVisible();

    // Paul réduit le stock à 5 kg entre-temps (API).
    const stock = await page.request.patch(`${URL_API}/produits/${produit.id}/stock/`, {
      headers: { ...bearer(jetonPaul), 'Content-Type': 'application/json' },
      data: { quantite_stock: '5' },
    });
    expect(stock.ok()).toBeTruthy();

    await page.goto('/panier');
    await expect(page.getByTestId('recapitulatif-panier')).toContainText(/insuffisant/i);
  });

  test('PW-F06-10 Timeline : chaque statut en français avec date', async ({ page }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const produit = await creerProduitApi(
      page,
      jetonPaul,
      exploitationId,
      `Suivi E2E-${suffixeUnique()}`
    );
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');
    const commande = await creerCommandeApi(page, jetonAmina, produit.id, domicileId);
    const acceptation = await page.request.post(
      `${URL_API}/commandes/${commande.id}/accepter/`,
      { headers: bearer(jetonPaul) }
    );
    expect(acceptation.ok()).toBeTruthy();

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commande.id}`);
    const timeline = page.getByTestId('timeline-commande');
    await expect(timeline).toBeVisible();
    await expect(timeline).toContainText('En attente');
    await expect(timeline).toContainText('Acceptée');
    await expect(timeline).toContainText(/\d{2}\/\d{2}\/\d{4}/);
    await verifierAccessibilite(page);
  });

  test("PW-F06-11 Paul ne voit l'adresse exacte qu'après paiement (avant : zone seulement)", async ({
    page,
  }) => {
    const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDe(page, jetonPaul);
    const produit = await creerProduitApi(
      page,
      jetonPaul,
      exploitationId,
      `Zone E2E-${suffixeUnique()}`
    );
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const domicileId = await adresseAmina(page, jetonAmina, 'Domicile');
    const commande = await creerCommandeApi(page, jetonAmina, produit.id, domicileId);
    const acceptation = await page.request.post(
      `${URL_API}/commandes/${commande.id}/accepter/`,
      { headers: bearer(jetonPaul) }
    );
    expect(acceptation.ok()).toBeTruthy();

    // Commande acceptée mais non payée : Paul voit la zone, pas l'adresse exacte.
    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/agriculteur/commandes/${commande.id}`);
    await expect(pagePaul.getByTestId('commande-adresse')).toContainText(/Zone/);
    await expect(pagePaul.getByTestId('commande-adresse')).not.toContainText(/Repères de démonstration/);
    await pagePaul.context().close();
  });
});
