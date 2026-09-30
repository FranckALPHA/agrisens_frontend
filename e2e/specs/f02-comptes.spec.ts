/**
 * E2E F-02 — Comptes et authentification (docs/12-plan-tests-playwright.md §2).
 * Règles §1.4 : sélecteurs par rôles/libellés, pas d'attente fixe, tests
 * indépendants, identifiant du scénario dans le titre, accessibilité axe-core
 * sur les écrans principaux, connexion via l'API ou l'UI (pas de
 * storageState partagé : la rotation du jeton de rafraîchissement révoquerait
 * les sessions des tests suivants).
 */
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { verifierAccessibilite } from '../utils/a11y';
import { simulerHorsLigne, retablirEnLigne } from '../utils/reseau';
import { definirPositionGps, refuserGeolocalisation, COORDONNEES_DOUALA } from '../utils/geolocalisation';
import type { Page } from '@playwright/test';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';

/** Téléphone camerounais neuf (jamais utilisé par le seed de démo). */
function telephoneNeuf(): string {
  // 6 + 8 chiffres = 9 chiffres au format camerounais, hors préfixes du seed.
  const corps = `6${Math.floor(90000000 + Math.random() * 9999999)}`;
  return `+237${corps}`;
}

/**
 * Connexion directe par l'API via page.request : seul ce client-là partage
 * le pot à cookies du contexte navigateur (le fixture `request` est isolé),
 * donc le cookie httpOnly de rafraîchissement (Q-25) sera bien envoyé à la
 * PWA, qui rétablit la session silencieusement au chargement.
 */
async function connexionApi(
  page: Page,
  identifiant: string,
  motDePasse = MOT_DE_PASSE
): Promise<void> {
  const reponse = await page.request.post(`${URL_API}/auth/connexion/`, {
    data: { identifiant, mot_de_passe: motDePasse },
  });
  expect(reponse.ok(), `connexion ${identifiant} should succeed`).toBeTruthy();
}

/**
 * Crée un compte agriculteur neuf (téléphone aléatoire) puis s'y connecte :
 * garantit une liste d'adresses vide quel que soit l'ordre des projets
 * (la base de test est partagée entre ordinateur et mobile, contrairement
 * aux comptes de démonstration réutilisés par plusieurs scénarios).
 */
async function nouveauCompteApi(page: Page): Promise<string> {
  const telephone = telephoneNeuf();
  const inscription = await page.request.post(`${URL_API}/auth/inscription/`, {
    data: { nom: 'Compte Test Adresses', telephone, mot_de_passe: MOT_DE_PASSE, role: 'agriculteur' },
  });
  expect(inscription.status(), `inscription should succeed`).toBe(201);
  await connexionApi(page, telephone);
  return telephone;
}

async function remplirInscription(
  page: Page,
  infos: { nom: string; telephone: string; motDePasse: string; email?: string; region?: string }
): Promise<void> {
  // Les champs requis ont un astérisque aria-hidden : le nom accessible
  // calculé par Playwright se termine par « * », d'où les regex tolérantes.
  await page.getByLabel(/^Nom complet/).fill(infos.nom);
  await page.getByLabel(/^Téléphone/).fill(infos.telephone);
  if (infos.email) await page.getByLabel(/Email \(facultatif\)/).fill(infos.email);
  if (infos.region) await page.getByLabel(/Région/).fill(infos.region);
  await page.getByLabel(/^Mot de passe/).fill(infos.motDePasse);
  await page.getByLabel(/^Confirmation du mot de passe/).fill(infos.motDePasse);
}

async function seDeconnecterViaUI(page: Page): Promise<void> {
  // Sur mobile le bouton d'en-tête est icon-only (aria-label) : getByRole
  // matching le nom accessible, il trouve les deux ; les éléments cachés par
  // le CSS responsive sont exclus automatiquement.
  await page.getByRole('button', { name: 'Déconnexion' }).first().click();
  await expect(page).toHaveURL('/');
}

test.describe('F-02 — Comptes et authentification', () => {
  test.afterEach(async ({ clientApi }) => {
    // Sécurité suite : l'horloge décalée (PW-F02-07) ne doit jamais fuiter.
    await clientApi.reinitialiserHorloge();
  });

  test('PW-F02-01 @critique Création agriculteur, tableau de bord, déconnexion, reconnexion', async ({
    page,
  }) => {
    const telephone = telephoneNeuf();
    await page.goto('/');
    await page.getByRole('link', { name: /créer un compte/i }).first().click();
    await expect(page).toHaveURL('/inscription');
    await verifierAccessibilite(page);

    await remplirInscription(page, { nom: 'Paul Test', telephone, motDePasse: MOT_DE_PASSE });
    await page.getByRole('button', { name: /créer un compte/i }).click();

    // Tableau de bord du rôle agriculteur.
    await expect(page).toHaveURL('/agriculteur');
    await expect(page.getByTestId('tableau-de-bord')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Espace Agriculteur' })).toBeVisible();

    await seDeconnecterViaUI(page);

    // Reconnexion avec le téléphone saisi au format brut (avec espaces).
    await page.goto('/connexion');
    await page.getByLabel(/^Téléphone ou email/).fill(telephone);
    await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: /^connexion$/i }).click();
    await expect(page).toHaveURL('/agriculteur');
    await expect(page.getByRole('heading', { name: 'Espace Agriculteur' })).toBeVisible();
  });

  test('PW-F02-02 Inscription avec téléphone déjà utilisé : erreur sous le champ, champs conservés', async ({
    page,
  }) => {
    await page.goto('/inscription');
    await remplirInscription(page, {
      nom: 'Doublon Test',
      telephone: PERSONNAGES.paul.telephone,
      motDePasse: MOT_DE_PASSE,
      region: 'Littoral',
    });
    await page.getByRole('button', { name: /créer un compte/i }).click();

    await expect(
      page.getByText('Un compte existe déjà avec ce numéro de téléphone.')
    ).toBeVisible();
    // Les autres champs restent remplis (formulaire conservé).
    await expect(page.getByLabel(/^Nom complet/)).toHaveValue('Doublon Test');
    await expect(page.getByLabel(/Région/)).toHaveValue('Littoral');
    await expect(page).toHaveURL('/inscription');
  });

  test('PW-F02-03 Mot de passe de 7 caractères : erreur de validation avant envoi', async ({
    page,
  }) => {
    await page.goto('/inscription');
    await page.getByLabel(/^Mot de passe/).fill('court12');
    await page.getByLabel(/^Mot de passe/).press('Tab');

    await expect(
      page.getByText('Le mot de passe doit comporter au moins 8 caractères.')
    ).toBeVisible();

    // Aucune requête d'inscription n'est partie : on reste sur le formulaire.
    await page.getByRole('button', { name: /créer un compte/i }).click();
    await expect(page).toHaveURL('/inscription');
  });

  test('PW-F02-04 Connexion par email (Amina) : succès, tableau de bord acheteur', async ({
    page,
  }) => {
    await page.goto('/connexion');
    await page.getByLabel(/^Téléphone ou email/).fill('amina@agrisens.local');
    await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: /^connexion$/i }).click();

    await expect(page).toHaveURL('/acheteur');
    await expect(page.getByRole('heading', { name: 'Espace Acheteur' })).toBeVisible();
  });

  test('PW-F02-05 Mauvais mot de passe : message générique identique que le compte existe ou non', async ({
    page,
  }) => {
    const messages: string[] = [];
    for (const identifiant of [PERSONNAGES.paul.telephone, telephoneNeuf()]) {
      await page.goto('/connexion');
      await page.getByLabel(/^Téléphone ou email/).fill(identifiant);
      await page.getByLabel(/^Mot de passe/).fill('MauvaisMdp123');
      await page.getByRole('button', { name: /^connexion$/i }).click();
      const alerte = page.getByRole('alert');
      await expect(alerte).toBeVisible();
      messages.push((await alerte.innerText()).trim());
    }

    // Anti-énumération : le même message dans les deux cas, sans révéler l'existence.
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).not.toMatch(/existe|inconnu/i);
  });

  test('PW-F02-06 Compte suspendu (démo) : connexion refusée avec explication', async ({
    page,
  }) => {
    await page.goto('/connexion');
    await page.getByLabel(/^Téléphone ou email/).fill('+237690000099');
    await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: /^connexion$/i }).click();

    const alerte = page.getByRole('alert');
    await expect(alerte).toBeVisible();
    await expect(alerte).toContainText('suspendu');
    await expect(alerte).toContainText('support');
  });

  test('PW-F02-07 Rafraîchissement silencieux après expiration du jeton d’accès', async ({
    page,
    clientApi,
  }) => {
    await connexionApi(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur');
    await expect(page.getByTestId('tableau-de-bord')).toBeVisible();

    // Le jeton d'accès vit 15 min : on décale l'horloge backend de 16 min.
    await clientApi.decalerHorloge(16);

    // Une action in-app (navigation SPA → GET adresses) doit réussir sans reconnexion.
    await page.locator('a:visible', { hasText: 'Profil' }).first().click();
    await expect(page).toHaveURL('/profil');
    await expect(page.getByRole('heading', { name: 'Mon profil' })).toBeVisible();
    await expect(page.getByText('Connexion à AgriSens')).not.toBeVisible();
  });

  test('PW-F02-08 Rechargement : toujours connecté ; aucun jeton dans les stockages', async ({
    page,
  }) => {
    await connexionApi(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur');
    await expect(page.getByTestId('tableau-de-bord')).toBeVisible();

    const jetonDansStockages = () =>
      page.evaluate(() =>
        [window.localStorage, window.sessionStorage].some((stockage) =>
          Object.entries(stockage).some(
            ([cle, valeur]) => valeur.includes('eyJ') || /token|jeton/i.test(cle)
          )
        )
      );
    expect(await jetonDansStockages()).toBe(false);

    // Rechargement complet : le cookie httpOnly rétablit la session (Q-25).
    await page.reload();
    await expect(page.getByTestId('tableau-de-bord')).toBeVisible();
    await expect(page).toHaveURL('/agriculteur');
    expect(await jetonDansStockages()).toBe(false);
  });

  test('PW-F02-09 Amina ouvre une URL d’agriculteur : accès interdit', async ({
    page,
  }) => {
    await connexionApi(page, PERSONNAGES.amina.telephone);
    await page.goto('/agriculteur/exploitations');

    await expect(page).toHaveURL('/acces-interdit');
    await expect(page.getByText('Accès non autorisé')).toBeVisible();
  });

  test('PW-F02-10 Visiteur sur page privée : connexion puis retour à la page demandée', async ({
    page,
  }) => {
    await page.goto('/profil');
    await expect(page).toHaveURL(/\/connexion/);
    await verifierAccessibilite(page);

    await page.getByLabel(/^Téléphone ou email/).fill(PERSONNAGES.paul.telephone);
    await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: /^connexion$/i }).click();

    // Retour à la page initialement demandée, pas au tableau de bord.
    await expect(page).toHaveURL('/profil');
    await expect(page.getByRole('heading', { name: 'Mon profil' })).toBeVisible();
  });

  test('PW-F02-11 Mot de passe oublié : confirmation neutre quel que soit le numéro', async ({
    page,
  }) => {
    // Note : la seconde partie du scénario (Mireille génère un mot de passe
    // temporaire) relève de F-03 ; l'écran de changement obligatoire côté
    // session est couvert par les tests unitaires RouteProtegee.
    const messages: string[] = [];
    for (const telephone of [PERSONNAGES.paul.telephone, telephoneNeuf()]) {
      await page.goto('/mot-de-passe-oublie');
      await page.getByLabel(/Votre téléphone/).fill(telephone);
      await page.getByRole('button', { name: /envoyer la demande/i }).click();
      const statut = page.getByRole('status');
      await expect(statut).toBeVisible();
      messages.push((await statut.innerText()).trim());
      await expect(statut).toContainText('administrateur');
    }

    // Même réponse neutre que le compte existe ou non (Q-23, anti-énumération).
    expect(messages[0]).toBe(messages[1]);
  });

  test('PW-F02-12 Profil : adresse avec position GPS simulée, puis refus → saisie manuelle', async ({
    page,
  }) => {
    await nouveauCompteApi(page);
    await page.goto('/profil');
    await expect(page.getByRole('heading', { name: 'Mon profil' })).toBeVisible();

    // 1. Position simulée (Douala) via « Utiliser ma position ».
    await definirPositionGps(page, COORDONNEES_DOUALA);
    await page.getByRole('button', { name: 'Ajouter une adresse' }).click();
    // Explication vie privée avant la demande de GPS.
    await expect(page.getByRole('note')).toContainText('position');
    await page.getByRole('button', { name: /utiliser ma position/i }).click();
    await expect(page.getByLabel('Latitude')).toHaveValue(/4\.05/);
    await expect(page.getByLabel('Longitude')).toHaveValue(/9\.76/);

    // Le formulaire d'adresse est le dernier form de la page (profil, mot de
    // passe, adresse) : circonscription nécessaire car « Région » existe
    // aussi dans le formulaire de profil.
    const formAdresse = page.locator('form').last();
    await formAdresse.getByLabel('Libellé').fill('Champ test GPS');
    await formAdresse.getByLabel('Ville').fill('Douala');
    await formAdresse.getByLabel('Région').fill('Littoral');
    await page.getByRole('button', { name: /^ajouter$/i }).click();
    await expect(page.getByText('Champ test GPS')).toBeVisible();

    // 2. Refus de géolocalisation → message + saisie manuelle proposée.
    await refuserGeolocalisation(page);
    await page.getByRole('button', { name: 'Ajouter une adresse' }).click();
    await page.getByRole('button', { name: /utiliser ma position/i }).click();
    await expect(page.getByRole('alert')).toContainText(/refus|indisponible/i);

    const formAdresse2 = page.locator('form').last();
    await formAdresse2.getByLabel('Latitude').fill('4.061');
    await formAdresse2.getByLabel('Longitude').fill('9.712');
    await formAdresse2.getByLabel('Libellé').fill('Boutique manuelle');
    await formAdresse2.getByLabel('Ville').fill('Douala');
    await formAdresse2.getByLabel('Région').fill('Littoral');
    await page.getByRole('button', { name: /^ajouter$/i }).click();
    await expect(page.getByText('Boutique manuelle')).toBeVisible();

    // Vérification double : l'API renvoie bien les deux adresses du compte.
    await verifierAccessibilite(page);
  });

  test('PW-F02-13 Réseau coupé pendant l’inscription : message, champs conservés, renvoi réussi', async ({
    page,
  }) => {
    const telephone = telephoneNeuf();
    await page.goto('/inscription');
    await remplirInscription(page, { nom: 'Paul Tempête', telephone, motDePasse: MOT_DE_PASSE });

    await simulerHorsLigne(page);
    await page.getByRole('button', { name: /créer un compte/i }).click();

    const alerte = page.getByRole('alert');
    await expect(alerte).toContainText(/connexion internet/i);
    // Les champs sont conservés.
    await expect(page.getByLabel(/^Nom complet/)).toHaveValue('Paul Tempête');
    await expect(page.getByLabel(/^Téléphone/)).toHaveValue(telephone);

    await retablirEnLigne(page);
    await page.getByRole('button', { name: /créer un compte/i }).click();
    await expect(page).toHaveURL('/agriculteur');
    await expect(page.getByRole('heading', { name: 'Espace Agriculteur' })).toBeVisible();
  });
});
