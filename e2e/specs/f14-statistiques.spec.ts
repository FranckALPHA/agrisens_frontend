/**
 * E2E F-14 — Statistiques et tableaux de bord (docs/12 §2, PW-F14-01 à 04).
 *
 * Scénarios :
 * - PW-F14-01 : Paul voit ses ventes avec les totaux exacts du jeu de démo,
 *   filtre de période appliqué.
 * - PW-F14-02 : Mireille voit les statistiques globales plateforme.
 * - PW-F14-03 : Amina appelle la route plateforme (API) → 403 ; l'écran n'existe
 *   pas dans son menu.
 * - PW-F14-04 : Tableaux de bord de chaque rôle : aucune erreur, chiffres présents,
 *   actions rapides fonctionnelles.
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';

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

test.describe('F-14 — Statistiques et tableaux de bord', () => {
  test('PW-F14-01 : Paul voit ses ventes avec totaux exacts et filtre de période', async ({
    page,
    request,
  }) => {
    const jetonPaul = await jetonDe(request, PERSONNAGES.paul.telephone);
    // Vérification API préalable des ventes confirmées de Paul
    const repApi = await request.get(`${URL_API}/statistiques/mes-ventes`, {
      headers: bearer(jetonPaul),
    });
    expect(repApi.ok()).toBeTruthy();
    const statsApi = (await repApi.json()) as {
      chiffre_affaires_brut_fcfa: number;
      nombre_ventes: number;
      quantite_totale: number;
      produits_populaires: Array<{ nom_produit: string; quantite: number }>;
    };

    await connexionUI(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur/statistiques');

    await expect(page.getByTestId('page-mes-statistiques')).toBeVisible();
    await expect(page.getByTestId('cartes-mes-ventes')).toBeVisible();

    // Vérifier les valeurs exactes affichées
    const carteCA = page.getByTestId('carte-stat-ca_brut');
    await expect(carteCA).toBeVisible();

    const carteVentes = page.getByTestId('carte-stat-nb_ventes');
    await expect(carteVentes).toContainText(String(statsApi.nombre_ventes));

    const carteQuantite = page.getByTestId('carte-stat-quantite');
    await expect(carteQuantite).toContainText(String(statsApi.quantite_totale));

    // Filtre de période appliqué : sélectionner une date future où il n'y a aucune vente
    await page.getByTestId('selecteur-periode-du').fill('2099-01-01');
    await page.getByTestId('selecteur-periode-au').fill('2099-12-31');

    await expect(page.getByTestId('carte-stat-nb_ventes')).toContainText('0');
    await expect(page.getByTestId('carte-stat-quantite')).toContainText('0');
  });

  test('PW-F14-02 : Mireille voit les statistiques globales de la plateforme', async ({
    page,
    request,
  }) => {
    const jetonMireille = await jetonDe(request, PERSONNAGES.mireille.telephone);
    const repApi = await request.get(`${URL_API}/statistiques/plateforme`, {
      headers: bearer(jetonMireille),
    });
    expect(repApi.ok()).toBeTruthy();
    const statsPlateforme = (await repApi.json()) as {
      total_commandes: number;
      total_utilisateurs: number;
      chiffre_affaires_fcfa: number;
    };

    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await page.goto('/admin/statistiques');

    await expect(page.getByTestId('page-statistiques-admin')).toBeVisible();
    await expect(page.getByTestId('cartes-plateforme')).toBeVisible();

    const carteCommandes = page.getByTestId('carte-stat-total_commandes');
    await expect(carteCommandes).toContainText(String(statsPlateforme.total_commandes));

    const carteUtilisateurs = page.getByTestId('carte-stat-total_utilisateurs');
    await expect(carteUtilisateurs).toContainText(String(statsPlateforme.total_utilisateurs));

    await expect(page.getByTestId('repartition-utilisateurs')).toBeVisible();
    await expect(page.getByTestId('repartition-commandes')).toBeVisible();
  });

  test('PW-F14-03 : Amina appelle la route plateforme (API) → 403 ; écran absent de son menu', async ({
    page,
    request,
  }) => {
    const jetonAmina = await jetonDe(request, PERSONNAGES.amina.telephone);

    // Vérification API : 403 Forbidden pour un acheteur
    const repApi = await request.get(`${URL_API}/statistiques/plateforme`, {
      headers: bearer(jetonAmina),
    });
    expect(repApi.status()).toBe(403);

    // Vérification UI : l'écran d'administration n'existe pas dans le menu d'Amina
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await expect(page.getByRole('link', { name: /Statistiques plateforme/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Administration/i })).toHaveCount(0);

    // Accès direct par URL → accès interdit
    await page.goto('/admin/statistiques');
    await expect(page.getByTestId('page-acces-interdit')).toBeVisible();
  });

  test('PW-F14-04 : Tableaux de bord de chaque rôle sans erreur, chiffres et actions rapides', async ({
    page,
  }) => {
    // 1. Agriculteur (Paul) -> redirigé vers /agriculteur
    await connexionUI(page, PERSONNAGES.paul.telephone);
    await expect(page).toHaveURL('/agriculteur');
    await expect(page.getByTestId('tb-agriculteur')).toBeVisible();
    await expect(page.getByTestId('actions-agriculteur')).toBeVisible();
    await page.getByTestId('action-rapide-statistiques').click();
    await expect(page).toHaveURL(/agriculteur\/statistiques/);

    // Déconnexion
    await page.goto('/connexion');

    // 2. Acheteur (Amina) -> redirigée vers /acheteur
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await expect(page).toHaveURL('/acheteur');
    await expect(page.getByTestId('tb-acheteur')).toBeVisible();
    await expect(page.getByTestId('actions-acheteur')).toBeVisible();
    await page.getByTestId('action-rapide-catalogue').click();
    await expect(page).toHaveURL(/catalogue/);

    // Déconnexion
    await page.goto('/connexion');

    // 3. Ingénieur (Nadia) -> redirigée vers /ingenieur
    await connexionUI(page, PERSONNAGES.nadia.telephone);
    await expect(page).toHaveURL('/ingenieur');
    await expect(page.getByTestId('tb-ingenieur')).toBeVisible();
    await expect(page.getByTestId('actions-ingenieur')).toBeVisible();
    await page.getByTestId('action-rapide-missions').click();
    await expect(page).toHaveURL(/ingenieur\/accompagnements/);

    // Déconnexion
    await page.goto('/connexion');

    // 4. Livreur (Jean) -> redirigé vers /livreur
    await connexionUI(page, PERSONNAGES.jean.telephone);
    await expect(page).toHaveURL('/livreur');
    await expect(page.getByTestId('tb-livreur')).toBeVisible();
    await expect(page.getByTestId('actions-livreur')).toBeVisible();
    await page.getByTestId('action-rapide-courses').click();
    await expect(page).toHaveURL(/livreur\/courses/);

    // Déconnexion
    await page.goto('/connexion');

    // 5. Admin (Mireille) -> redirigée vers /admin
    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await expect(page).toHaveURL('/admin');
    await expect(page.getByTestId('tb-admin')).toBeVisible();
    await page.getByTestId('tb-statistiques-completes').click();
    await expect(page).toHaveURL(/admin\/statistiques/);
  });
});
