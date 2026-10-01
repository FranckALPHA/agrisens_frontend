/**
 * E2E F-05 — Produits, catalogue et stock (docs/12-plan-tests-playwright.md §2).
 * Règles §1.4 : rôles/libellés d'abord, aucune attente fixe, données uniques
 * par test, identifiant dans chaque titre, double vérification écran + API.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { verifierAccessibilite } from '../utils/a11y';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';
const DOSSIER_FICHIERS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/fichiers'
);

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

function bearer(jeton: string): Record<string, string> {
  return { Authorization: `Bearer ${jeton}` };
}

/** Connexion par l'API qui rend aussi le jeton d'accès (vérifications API). */
async function connexionApiAvecJeton(page: Page, identifiant: string): Promise<string> {
  const reponse = await page.request.post(`${URL_API}/auth/connexion/`, {
    data: { identifiant, mot_de_passe: MOT_DE_PASSE },
  });
  expect(reponse.ok(), 'la connexion API doit réussir').toBeTruthy();
  const corps = (await reponse.json()) as { jeton_acces: string };
  return corps.jeton_acces;
}

/** Connexion via le formulaire (attend la sortie de /connexion). */
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

/** Contexte navigateur frais (visiteur anonyme). */
async function nouvellePage(contexteParent: import('@playwright/test').BrowserContext): Promise<Page> {
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

/** Exploitation de Paul pour rattacher les produits créés par l'API. */
async function exploitationDePaul(page: Page, jeton: string): Promise<string> {
  const reponse = await page.request.get(`${URL_API}/exploitations/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  const liste = (await reponse.json()) as Array<{ id: string; nom: string }>;
  const champ = liste.find((e) => e.nom === 'Champ Nord') ?? liste[0];
  expect(champ, 'Paul doit avoir une exploitation').toBeDefined();
  return champ!.id;
}

async function creerProduitApi(
  page: Page,
  jeton: string,
  exploitationId: string,
  infos: {
    nom: string;
    categorie?: string;
    unite?: string;
    prix?: number;
    quantite?: string;
    avecPhoto?: boolean;
  }
): Promise<ProduitCree> {
  const photoIds: string[] = [];
  if (infos.avecPhoto) {
    const contenu = fs.readFileSync(path.join(DOSSIER_FICHIERS, 'photo-tomates.jpg'));
    const upload = await page.request.post(`${URL_API}/fichiers/`, {
      headers: bearer(jeton),
      multipart: {
        contexte: 'produit',
        fichier: { name: 'tomates.jpg', mimeType: 'image/jpeg', buffer: contenu },
      },
    });
    expect(upload.status(), "l'upload photo doit réussir").toBe(201);
    photoIds.push(((await upload.json()) as { id: string }).id);
  }
  const creation = await page.request.post(`${URL_API}/produits/`, {
    headers: { ...bearer(jeton), 'Content-Type': 'application/json' },
    data: {
      nom: infos.nom,
      categorie: infos.categorie ?? 'legumes',
      unite: infos.unite ?? 'kg',
      prix_unitaire_fcfa: infos.prix ?? 500,
      quantite_stock: infos.quantite ?? '100',
      exploitation_id: exploitationId,
      photo_ids: photoIds,
    },
  });
  expect(creation.status(), 'la création produit doit réussir').toBe(201);
  const corps = (await creation.json()) as ProduitCree;
  return { id: corps.id, nom: infos.nom };
}

test.describe('F-05 — Produits, catalogue et stock', () => {
  test('PW-F05-01 @critique Paul publie 100 kg de tomates avec photo (aperçu) ; visiteur et Amina les trouvent', async ({
    page,
  }) => {
    await connexionUI(page, PERSONNAGES.paul.telephone);
    const nom = `Tomates E2E-${suffixeUnique()}`;
    await page.goto('/agriculteur/produits/nouveau');
    await expect(page.getByRole('heading', { name: 'Nouveau produit' })).toBeVisible();
    await verifierAccessibilite(page);

    // Exploitation explicite (Paul peut en avoir plusieurs via F-04).
    const jetonExploitations = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const reponseExploitations = await page.request.get(`${URL_API}/exploitations/`, {
      headers: bearer(jetonExploitations),
    });
    const champNord = ((await reponseExploitations.json()) as Array<{
      id: string;
      nom: string;
    }>).find((e) => e.nom === 'Champ Nord')!;
    await page.getByLabel(/Exploitation/).selectOption(champNord.id);

    await page.getByLabel(/Nom du produit/).fill(nom);
    await page.getByLabel(/Prix \(FCFA\)/).fill('500');
    await page.getByLabel(/Quantité/).fill('100');
    await page.getByTestId('champ-fichier').setInputFiles(path.join(DOSSIER_FICHIERS, 'photo-tomates.jpg'));
    await expect(page.getByTestId('liste-photos-produit')).toBeVisible();

    // Aperçu avant publication, comme au catalogue.
    await page.getByRole('button', { name: 'Aperçu avant publication' }).click();
    await expect(page.getByRole('heading', { name: 'Aperçu avant publication' })).toBeVisible();
    await expect(page.getByRole('article', { name: `Produit ${nom}` })).toBeVisible();
    await page.getByRole('button', { name: 'Publier le produit' }).click();

    await expect(page).toHaveURL('/agriculteur/produits');
    await expect(page.getByRole('heading', { name: nom })).toBeVisible();

    // Double vérification API : photo liée, statut disponible.
    const jeton = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const mesProduits = await page.request.get(`${URL_API}/produits/mes-produits/`, {
      headers: bearer(jeton),
    });
    const element = ((await mesProduits.json()).elements as Array<{
      id: string;
      nom: string;
      statut: string;
      photos: Array<{ fichier_id: string }>;
    }>).find((e) => e.nom === nom);
    expect(element?.statut).toBe('disponible');
    expect(element?.photos.length).toBeGreaterThanOrEqual(1);

    // Un visiteur anonyme le trouve via le filtre Légumes.
    const visiteur = await nouvellePage(page.context());
    await visiteur.goto('/catalogue');
    await visiteur.getByTestId('filtre-categorie').selectOption('legumes');
    await expect(visiteur.getByRole('heading', { name: nom })).toBeVisible();
    await visiteur.context().close();

    // Amina aussi, connectée.
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto('/catalogue');
    await page.getByTestId('filtre-categorie').selectOption('legumes');
    await expect(page.getByRole('heading', { name: nom })).toBeVisible();
  });

  test('PW-F05-02 Détail : producteur et région visibles, ni téléphone ni coordonnées', async ({
    page,
  }) => {
    const jeton = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDePaul(page, jeton);
    const produit = await creerProduitApi(page, jeton, exploitationId, {
      nom: `Tomates Detail E2E-${suffixeUnique()}`,
      avecPhoto: true,
    });

    await page.goto(`/catalogue/${produit.id}`);
    await expect(page.getByRole('heading', { name: produit.nom })).toBeVisible();
    await expect(page.getByText('Paul Mbianda')).toBeVisible();
    await verifierAccessibilite(page);

    const html = await page.content();
    expect(html).not.toContain('+237');
    expect(html).not.toMatch(/\b\d{1,2}\.\d{4,}\b/);
    await expect(page.getByRole('button', { name: 'Ajouter au panier' })).toBeEnabled();
  });

  test('PW-F05-03 Recherche, filtres région/prix et tri par prix croissant', async ({
    page,
  }) => {
    const jeton = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDePaul(page, jeton);
    const prefixe = `Tri E2E-${suffixeUnique()}`;
    await creerProduitApi(page, jeton, exploitationId, { nom: `${prefixe} A`, prix: 100 });
    await creerProduitApi(page, jeton, exploitationId, { nom: `${prefixe} B`, prix: 300 });
    await creerProduitApi(page, jeton, exploitationId, { nom: `${prefixe} C`, prix: 200 });

    await page.goto('/catalogue');
    await page.getByLabel(/Rechercher un produit/).fill(prefixe);
    await expect(page.getByText('3 produit(s) au catalogue.')).toBeVisible();

    await page.getByTestId('filtre-region').selectOption('centre');
    await expect(page.getByText('3 produit(s) au catalogue.')).toBeVisible();

    await page.getByLabel(/Prix min/).fill('150');
    await page.getByLabel(/Prix max/).fill('250');
    await expect(page.getByText('1 produit(s) au catalogue.')).toBeVisible();
    await expect(page.getByRole('heading', { name: `${prefixe} C` })).toBeVisible();
    await page.getByLabel(/Prix min/).fill('');
    await page.getByLabel(/Prix max/).fill('');

    await page.getByTestId('tri-catalogue').selectOption('prix_asc');
    const titres = page.getByRole('article').getByRole('heading');
    await expect(titres.nth(0)).toHaveText(`${prefixe} A`);
    await expect(titres.nth(1)).toHaveText(`${prefixe} C`);
    await expect(titres.nth(2)).toHaveText(`${prefixe} B`);
  });

  test('PW-F05-04 Pagination : page 2 différente de la page 1, sans doublon', async ({
    page,
  }) => {
    const jeton = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDePaul(page, jeton);
    const prefixe = `Page E2E-${suffixeUnique()}`;
    for (let i = 0; i < 13; i += 1) {
      await creerProduitApi(page, jeton, exploitationId, { nom: `${prefixe} ${i}` });
    }

    await page.goto('/catalogue');
    await page.getByLabel(/Rechercher un produit/).fill(prefixe);
    await expect(page.getByText('13 produit(s) au catalogue.')).toBeVisible();
    const page1 = await page.getByRole('article').getByRole('heading').allTextContents();
    expect(page1).toHaveLength(12);
    await page.getByRole('button', { name: 'Page suivante' }).click();
    await expect(page.getByText(/Page 2 sur 2/)).toBeVisible();
    const page2 = await page.getByRole('article').getByRole('heading').allTextContents();
    expect(page2).toHaveLength(1);
    expect(page2[0]).not.toContain(page1[0]);
    const melange = [...page1, ...(page2 as string[])];
    expect(new Set(melange).size).toBe(melange.length);
  });

  test('PW-F05-05 Retrait : disparaît du catalogue, détail « produit indisponible »', async ({
    page,
  }) => {
    const jeton = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDePaul(page, jeton);
    const produit = await creerProduitApi(page, jeton, exploitationId, {
      nom: `Retrait E2E-${suffixeUnique()}`,
    });

    await connexionUI(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur/produits');
    const carte = page.getByRole('article', { name: `Produit ${produit.nom}` });
    await carte.getByRole('button', { name: 'Retirer' }).click();
    await expect(page.getByRole('dialog')).toContainText(produit.nom);
    await page.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();
    // Dans « Mes produits », la carte reste avec le badge « Retiré » (historique conservé).
    await expect(carte.getByText('Retiré')).toBeVisible();

    await page.goto('/catalogue');
    await page.getByLabel(/Rechercher un produit/).fill(produit.nom);
    await expect(page.getByText('Aucun produit trouvé')).toBeVisible();

    await page.goto(`/catalogue/${produit.id}`);
    await expect(page.getByTestId('produit-indisponible')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Produit indisponible' })).toBeVisible();
  });

  test('PW-F05-06 Stock à 0 : badge « épuisé » chez Paul, absent du catalogue', async ({
    page,
  }) => {
    const jeton = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const exploitationId = await exploitationDePaul(page, jeton);
    const produit = await creerProduitApi(page, jeton, exploitationId, {
      nom: `Epuise E2E-${suffixeUnique()}`,
      quantite: '10',
    });

    await connexionUI(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur/produits');
    const carte = page.getByRole('article', { name: `Produit ${produit.nom}` });
    await carte.getByLabel(`Nouveau stock pour ${produit.nom}`).fill('0');
    await carte.getByRole('button', { name: 'Mettre à jour' }).click();
    await expect(carte.getByText('Épuisé')).toBeVisible();

    const visiteur = await nouvellePage(page.context());
    await visiteur.goto('/catalogue');
    await visiteur.getByLabel(/Rechercher un produit/).fill(produit.nom);
    await expect(visiteur.getByText('Aucun produit trouvé')).toBeVisible();
    await visiteur.context().close();
  });

  test('PW-F05-07 Prix négatif refusé dans le formulaire', async ({ page }) => {
    await connexionUI(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur/produits/nouveau');
    const jetonExploitations = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
    const reponseExploitations = await page.request.get(`${URL_API}/exploitations/`, {
      headers: bearer(jetonExploitations),
    });
    const champNord = ((await reponseExploitations.json()) as Array<{
      id: string;
      nom: string;
    }>).find((e) => e.nom === 'Champ Nord')!;
    await page.getByLabel(/Exploitation/).selectOption(champNord.id);
    await page.getByLabel(/Nom du produit/).fill(`Prix Neg E2E-${suffixeUnique()}`);
    await page.getByLabel(/Prix \(FCFA\)/).fill('-50');
    await page.getByLabel(/Quantité/).fill('10');
    await page.getByRole('button', { name: 'Publier le produit', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/prix/i);
  });

  test('PW-F05-08 Catalogue vide : état vide avec suggestion', async ({ page }) => {
    await page.goto('/catalogue');
    await expect(page.getByRole('heading', { name: 'Catalogue des produits' })).toBeVisible();
    await verifierAccessibilite(page);
    await page.getByLabel(/Rechercher un produit/).fill('zzz-produit-inexistant-zzz');
    await expect(page.getByRole('heading', { name: 'Aucun produit trouvé' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voir tout le catalogue' })).toBeVisible();
  });
});
