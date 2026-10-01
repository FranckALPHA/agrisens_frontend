/**
 * E2E F-03 — Fichiers, notifications, profils pro, validation admin
 * (docs/12-plan-tests-playwright.md §2, scénarios PW-F03-01 à PW-F03-09).
 * Règles §1.4 : sélecteurs par rôles/libellés puis data-testid, aucune
 * attente fixe, indépendance des tests (chaque test crée ses propres
 * comptes ; les comptes de démonstration ne sont que lus ou restaurés à
 * la fin du test qui les modifie), identifiant PW-… dans chaque titre,
 * accèsibilité axe-core sur les écrans principaux.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect, test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { verifierAccessibilite } from '../utils/a11y';
import { simulerReseauLent } from '../utils/reseau';
import type { Page } from '@playwright/test';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';
const DOSSIER_FICHIERS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/fichiers'
);

/** Téléphone camerounais neuf (hors préfixes du seed de démo). */
function telephoneNeuf(): string {
  const corps = `6${Math.floor(90000000 + Math.random() * 9999999)}`;
  return `+237${corps}`;
}

/** Connexion par l'API qui rend aussi le jeton d'accès (vérifications API). */
async function connexionApiAvecJeton(
  page: Page,
  identifiant: string,
  motDePasse = MOT_DE_PASSE
): Promise<string> {
  const reponse = await page.request.post(`${URL_API}/auth/connexion/`, {
    data: { identifiant, mot_de_passe: motDePasse },
  });
  expect(reponse.ok(), `connexion ${identifiant} should succeed`).toBeTruthy();
  const corps = (await reponse.json()) as { jeton_acces: string };
  return corps.jeton_acces;
}

/** En-têtes Bearer pour appels API de préparation/vérification. */
function bearer(jeton: string): Record<string, string> {
  return { Authorization: `Bearer ${jeton}` };
}

/** Connexion via le formulaire de la PWA (parcours réel FE-02). */
async function connexionUI(page: Page, telephone: string, motDePasse = MOT_DE_PASSE): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel(/^Téléphone ou email/).fill(telephone);
  await page.getByLabel(/^Mot de passe/).fill(motDePasse);
  // Attendre la réponse de connexion PUIS la sortie de /connexion : sans
  // cela, un `goto` ultérieur part avant l'établissement de la session et
  // la garde redirige vers /connexion (course perdue).
  const [reponse] = await Promise.all([
    page.waitForResponse(
      (req) => req.url().includes('/auth/connexion') && req.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /^connexion$/i }).click(),
  ]);
  expect(reponse.ok(), 'la connexion UI doit réussir').toBeTruthy();
  await expect(page).not.toHaveURL('/connexion');
}

interface DossierEngineur {
  id: string;
  nom: string;
  telephone: string;
  jeton: string;
}

/**
 * Crée par l'API un compte ingénieur `en_attente_validation` avec un
 * justificatif déposé (diplôme PDF) : préparation indépendante pour les
 * scénarios de validation/refus/suspension (les personnages de démo ne
 * sont jamais modifiés par ces tests, sauf restauration en fin de test).
 */
async function nouvelEngineurAvecJustificatif(
  page: Page,
  nom: string,
  typeJustificatif = 'diplome'
): Promise<DossierEngineur> {
  const telephone = telephoneNeuf();
  const inscription = await page.request.post(`${URL_API}/auth/inscription/`, {
    data: { nom, telephone, mot_de_passe: MOT_DE_PASSE, role: 'ingenieur_agronome', region: 'Littoral' },
  });
  expect(inscription.status(), 'inscription ingénieur should succeed').toBe(201);
  const session = (await inscription.json()) as {
    jeton_acces: string;
    utilisateur: { id: string };
  };
  const jeton = session.jeton_acces;

  // Upload du justificatif (multipart, contexte justificatif) puis dépôt.
  const contenu = fs.readFileSync(path.join(DOSSIER_FICHIERS, 'justificatif.pdf'));
  const upload = await page.request.post(`${URL_API}/fichiers/`, {
    headers: bearer(jeton),
    multipart: {
      contexte: 'justificatif',
      fichier: { name: 'justificatif.pdf', mimeType: 'application/pdf', buffer: contenu },
    },
  });
  expect(upload.status(), 'upload justificatif should succeed').toBe(201);
  const fichier = (await upload.json()) as { id: string };

  const depot = await page.request.post(`${URL_API}/ingenieurs/moi/justificatifs/`, {
    headers: { ...bearer(jeton), 'Content-Type': 'application/json' },
    data: { fichier_id: fichier.id, type: typeJustificatif },
  });
  expect(depot.status(), 'dépôt justificatif should succeed').toBe(201);

  return { id: session.utilisateur.id, nom, telephone, jeton };
}

/** Second contexte navigateur (session distincte dans la même suite). */
async function nouvellePage(contexteParent: import('@playwright/test').BrowserContext): Promise<Page> {
  const browser = contexteParent.browser();
  const contexte = await browser!.newContext({
    baseURL: 'http://127.0.0.1:4173',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  });
  return contexte.newPage();
}

/** Compteur de la cloche visible (rendu responsive en double : bureau + mobile). */
function compteurVisible(page: Page) {
  return page.locator('[data-testid="compteur-notifications"]:visible');
}

/** Ouvre le dossier ADM-02 d'un utilisateur par sa recherche de nom. */
async function ouvrirDossierAdmin(page: Page, idUtilisateur: string, nom: string): Promise<void> {
  await page.goto('/admin/utilisateurs');
  await expect(page.getByTestId('page-utilisateurs-admin')).toBeVisible();
  await page.getByLabel(/Rechercher un nom/).fill(nom);
  // Le tableau responsive rend chaque ligne en double (bureau + mobile, une
  // variante masquée par CSS) : seul le bouton visible est cliquable.
  await page
    .locator(`[data-testid="lien-detail-utilisateur-${idUtilisateur}"]:visible`)
    .click();
  await expect(page.getByTestId('panneau-detail-utilisateur')).toBeVisible();
}

test.describe('F-03 — Fichiers, notifications, profils pro, validation admin', () => {
  test('PW-F03-01 Nadia (nouvelle account) s inscrit ingénieure, complète ING-02 et dépose ses justificatifs', async ({
    page,
  }) => {
    const telephone = telephoneNeuf();
    const nom = 'Nadia Test F03';

    // 1. Inscription côté UI en tant qu'ingénieure agronome.
    await page.goto('/inscription');
    await page.getByText('Ingénieur agronome').click();
    await page.getByLabel(/^Nom complet/).fill(nom);
    await page.getByLabel(/^Téléphone/).fill(telephone);
    await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
    await page.getByLabel(/^Confirmation du mot de passe/).fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: /créer un compte/i }).click();

    // Écran « compte en attente » (D-13).
    await expect(page).toHaveURL('/ingenieur');
    await expect(page.getByTestId('ecran-attente')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compte en attente de validation' })).toBeVisible();

    // 2. ING-02 accessible dès l'attente : profil professionnel.
    await page.goto('/ingenieur/profil-pro');
    const bandeau = page.getByTestId('bandeau-statut-validation');
    await expect(bandeau).toContainText('En attente de validation');
    await verifierAccessibilite(page);

    await page.getByLabel('Maraîchage').check();
    await page.getByTestId('champ-region').selectOption('littoral');
    await page.getByLabel('Latitude').fill('4.0511');
    await page.getByLabel('Longitude').fill('9.7679');
    await page.getByTestId('champ-rayon').fill('60');
    await page.getByTestId('champ-tarif').fill('15000');
    await page.getByTestId('bouton-enregistrer-profil-pro').click();
    await expect(page.getByRole('status').filter({ hasText: 'Profil professionnel enregistré' })).toBeVisible();

    // 3. Justificatif : dépôt du diplôme (PDF).
    await page.getByTestId('selecteur-type-justificatif').selectOption('diplome');
    await page.getByTestId('champ-fichier').setInputFiles(path.join(DOSSIER_FICHIERS, 'justificatif.pdf'));
    const liste = page.getByTestId('liste-justificatifs');
    await expect(liste.getByTestId('justificatif-diplome')).toBeVisible();
    await expect(liste.getByTestId('justificatif-diplome')).toContainText('Soumise');

    // Vérification double : l'API a bien enregistré profil + justificatif.
    const jeton = await connexionApiAvecJeton(page, telephone);
    const profilReponse = await page.request.get(`${URL_API}/ingenieurs/moi/profil/`, {
      headers: bearer(jeton),
    });
    expect(profilReponse.status()).toBe(200);
    const profil = await profilReponse.json();
    expect(profil.specialites).toContain('maraichage');
    expect(profil.region).toBe('littoral');
    expect(profil.tarif_consultation_fcfa).toBe(15000);
    expect(profil.zone_rayon_km).toBe(60);
    expect(profil.statut_validation).toBe('en_attente');
    const piecesReponse = await page.request.get(`${URL_API}/ingenieurs/moi/justificatifs/`, {
      headers: bearer(jeton),
    });
    const pieces = await piecesReponse.json();
    expect(Array.isArray(pieces) ? pieces.length : pieces.elements.length).toBeGreaterThanOrEqual(1);
  });

  test('PW-F03-02 Mireille valide le dossier ; la nouvelle ingénieure reçoit la notification et accède à son espace', async ({
    page,
  }) => {
    const dossier = await nouvelEngineurAvecJustificatif(page, 'Clarisse Validation F03');

    // Mireille (admin) consulte le dossier et les justificatifs.
    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await ouvrirDossierAdmin(page, dossier.id, dossier.nom);
    await expect(page.getByTestId('detail-justificatifs')).toContainText('Diplôme');
    await verifierAccessibilite(page);

    // Visualisation du justificatif : « Voir » ouvre le document dans un onglet.
    // (Le contenu servi — 302 puis 200 — est vérifié par les tests backend et
    // PW-F03-07 ; le Chromium headless ne navigue pas l'onglet vers l'URL blob,
    // on prouve donc l'ouverture sans erreur plutôt que l'URL.)
    const [apercu] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByTestId('bouton-voir-justificatif-diplome').click(),
    ]);
    await expect(page.getByTestId('panneau-detail-utilisateur')).toBeVisible();
    await apercu.close();

    await page.getByTestId('bouton-valider-ingenieur').click();

    // Vérification double : l'API confirme compte actif + profil validé.
    const jetonAdmin = await connexionApiAvecJeton(page, PERSONNAGES.mireille.telephone);
    const detail = await page.request.get(`${URL_API}/admin/utilisateurs/${dossier.id}/`, {
      headers: bearer(jetonAdmin),
    });
    const detailJson = await detail.json();
    expect(detailJson.statut_compte).toBe('actif');
    expect(detailJson.profil_ingenieur.statut_validation).toBe('valide');

    // L'ingénieure (session fraîche) voit la cloche à 1 et son espace complet.
    const page2 = await nouvellePage(page.context());
    await connexionUI(page2, dossier.telephone);
    await expect(page2).toHaveURL('/ingenieur');
    await expect(page2.getByTestId('tableau-de-bord')).toBeVisible();
    await expect(page2.getByRole('heading', { name: 'Espace Ingénieur Agronome' })).toBeVisible();
    await expect(compteurVisible(page2)).toHaveText('1');
    // La cloche est rendue en double (bureau + mobile) : agir sur le visible.
    await page2.locator('[data-testid="bouton-cloche"]:visible').click();
    await expect(page2.locator('[data-testid="panneau-notifications"]:visible')).toContainText(
      'Votre profil ingénieur est validé'
    );
    await page2.context().close();
  });

  test('PW-F03-03 Refus sans motif : bouton désactivé ; avec motif : le motif est visible par l’ingénieure', async ({
    page,
  }) => {
    const dossier = await nouvelEngineurAvecJustificatif(page, 'Bella Refus F03');

    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await ouvrirDossierAdmin(page, dossier.id, dossier.nom);

    // Sans motif, le bouton Refuser reste désactivé (PW-F03-03).
    await expect(page.getByTestId('bouton-refuser-ingenieur')).toBeDisabled();
    await page.getByTestId('champ-motif-refus').fill('Diplôme illisible, merci de le redéposer.');
    await expect(page.getByTestId('bouton-refuser-ingenieur')).toBeEnabled();
    await page.getByTestId('bouton-refuser-ingenieur').click();
    await expect(page.getByRole('status').filter({ hasText: 'Ingénieur refusé' })).toBeVisible();
    await expect(page.getByTestId('detail-motif-refus')).toContainText('Diplôme illisible');

    // L'ingénieure voit le motif dans son bandeau de statut (ING-02).
    const page2 = await nouvellePage(page.context());
    await connexionUI(page2, dossier.telephone);
    await page2.goto('/ingenieur/profil-pro');
    await expect(page2.getByTestId('motif-refus')).toContainText(
      'Diplôme illisible, merci de le redéposer.'
    );
    await page2.context().close();
  });

  test('PW-F03-04 Mireille suspend Jean : déconnecté à sa prochaine action, reconnexion refusée, puis réactivé', async ({
    page,
  }) => {
    // Jean ouvre une session réelle dans le contexte du test.
    await connexionUI(page, PERSONNAGES.jean.telephone);
    await expect(page).toHaveURL('/livreur');

    // Mireille (admin) dans un second contexte : session API (cookie httpOnly +
    // jeton) pour récupérer l'identifiant réel de Jean, puis pilotage d'ADM-02.
    const pageAdmin = await nouvellePage(page.context());
    const jetonAdmin = await connexionApiAvecJeton(pageAdmin, PERSONNAGES.mireille.telephone);
    const recherche = await pageAdmin.request.get(
      `${URL_API}/admin/utilisateurs/?recherche=${encodeURIComponent('Jean Tchinda')}`,
      { headers: bearer(jetonAdmin) }
    );
    expect(recherche.status()).toBe(200);
    const jeanId = ((await recherche.json()).elements[0] as { id: string }).id;
    await ouvrirDossierAdmin(pageAdmin, jeanId, 'Jean Tchinda');
    await pageAdmin.getByTestId('bouton-suspendre').click();
    await pageAdmin.getByTestId('champ-motif-suspension').fill('Litiges répétés (test E2E).');
    await pageAdmin.getByTestId('bouton-confirmer-suspension').click();
    await expect(pageAdmin.getByRole('status').filter({ hasText: 'Compte suspendu' })).toBeVisible();

    // Prochaine action de Jean → déconnexion vers /connexion (403 compte_suspendu,
    // sessions révoquées) : « Disponibilité » appelle l'API, qui purge la session.
    await page.locator('a:visible', { hasText: /^Disponibilité$/ }).first().click();
    await expect(page).toHaveURL('/connexion');

    // Reconnexion refusée tant que le compte est suspendu.
    await page.getByLabel(/^Téléphone ou email/).fill(PERSONNAGES.jean.telephone);
    await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: /^connexion$/i }).click();
    await expect(page.getByRole('alert')).toContainText('suspendu');

    // Réactivation par Mireille : le panneau déjà ouvert bascule sur « Réactiver »
    // (invalidation de la requête après suspension), puis disparaît après clic.
    await pageAdmin.getByTestId('bouton-reactiver').click();
    await expect(pageAdmin.getByTestId('bouton-reactiver')).toBeHidden();
    await pageAdmin.context().close();

    // Jean peut de nouveau se connecter (remise en état du compte de démonstration).
    // Retour à la page demandée avant la coupure (PW-F02-10) : il était sur
    // « Disponibilité » quand sa session a été purgée.
    await connexionUI(page, PERSONNAGES.jean.telephone);
    await expect(page).toHaveURL('/livreur/disponibilite');
  });

  test('PW-F03-05 Faux .jpg (exécutable renommé) refusé ; image trop lourde refusée avec la limite affichée', async ({
    page,
  }) => {
    const dossier = await nouvelEngineurAvecJustificatif(page, 'Amina Filtre F03');
    await connexionUI(page, dossier.telephone);
    await page.goto('/ingenieur/profil-pro');

    // 1. Extension .jpg mais contenu script : refusé sur le type réel (Q-14).
    await page.getByTestId('champ-fichier').setInputFiles(path.join(DOSSIER_FICHIERS, 'faux-image.jpg'));
    const alerte = page.getByTestId('erreur-televersement');
    await expect(alerte).toBeVisible();
    await expect(alerte).toContainText('son extension ne correspond pas à son contenu');

    // 2. Image au-dessus de la limite (paramètre fichiers.image_max_mo = 5 Mo).
    await expect(page.getByTestId('televersement-fichier')).toContainText('Images : 5 Mo max');
    await page.getByTestId('champ-fichier').setInputFiles(path.join(DOSSIER_FICHIERS, 'image-trop-lourde.jpg'));
    await expect(alerte).toContainText('Fichier trop volumineux (limite : 5 Mo)');
  });

  test('PW-F03-06 Téléversement sur réseau lent : barre de progression visible et aperçu de l’image', async ({
    page,
  }) => {
    const dossier = await nouvelEngineurAvecJustificatif(page, 'Paul Progression F03');
    await connexionUI(page, dossier.telephone);
    await page.goto('/ingenieur/profil-pro');

    // 3G lente (utils/reseau) : l'envoi dure assez pour observer la progression.
    const cdp = await simulerReseauLent(page);
    await page.getByTestId('selecteur-type-justificatif').selectOption('piece_identite');
    await page.getByTestId('champ-fichier').setInputFiles(path.join(DOSSIER_FICHIERS, 'photo-tomates.jpg'));

    await expect(page.getByTestId('apercu-image')).toBeVisible();
    const barre = page.getByTestId('barre-progression');
    await expect(barre).toBeVisible();
    await expect(barre).toHaveAttribute('role', 'progressbar');

    // Retour réseau normal puis fin de l'envoi.
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await expect(page.getByTestId('liste-justificatifs').getByTestId('justificatif-piece_identite')).toBeVisible();
  });

  test('PW-F03-07 Amina ouvre l’URL d’un justificatif de Nadia : pas d’accès (404)', async ({ page }) => {
    // Nadia (seed) récupère l'identifiant d'un de ses justificatifs.
    const jetonNadia = await connexionApiAvecJeton(page, PERSONNAGES.nadia.telephone);
    const piecesReponse = await page.request.get(`${URL_API}/ingenieurs/moi/justificatifs/`, {
      headers: bearer(jetonNadia),
    });
    expect(piecesReponse.status()).toBe(200);
    const pieces = await piecesReponse.json();
    const liste: Array<Record<string, unknown>> = Array.isArray(pieces) ? pieces : pieces.elements;
    expect(liste.length).toBeGreaterThan(0);
    const premiere = liste[0] as { fichier_id?: string; fichier?: { id: string } };
    const idFichier = premiere.fichier_id ?? premiere.fichier?.id;
    expect(idFichier).toBeTruthy();

    // Nadia (propriétaire) y accède bien : 200 après la redirection signée.
    const accesProprietaire = await page.request.get(`${URL_API}/fichiers/${idFichier}/`, {
      headers: bearer(jetonNadia),
    });
    expect(accesProprietaire.status()).toBe(200);

    // Amina (autre utilisateur) : 404 silencieux, jamais 403 (conventions §5).
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const accesRefuse = await page.request.get(`${URL_API}/fichiers/${idFichier}/`, {
      headers: bearer(jetonAmina),
    });
    expect(accesRefuse.status()).toBe(404);
    expect((await accesRefuse.json()).erreur.code).toBe('ressource_introuvable');
  });

  test('PW-F03-08 Notifications : ouverture du lien + statut lu + compteur ; « tout marquer comme lu »', async ({
    page,
  }) => {
    const dossier = await nouvelEngineurAvecJustificatif(page, 'Rachida Notifs F03');

    // Trois notifications via l'API admin : validation, suspension, réactivation.
    const jetonAdmin = await connexionApiAvecJeton(page, PERSONNAGES.mireille.telephone);
    const valider = await page.request.post(`${URL_API}/admin/ingenieurs/${dossier.id}/valider/`, {
      headers: bearer(jetonAdmin),
      data: {},
    });
    expect(valider.status()).toBe(200);
    const suspendre = await page.request.post(`${URL_API}/admin/utilisateurs/${dossier.id}/suspendre/`, {
      headers: bearer(jetonAdmin),
      data: { motif: 'Test notifications' },
    });
    expect(suspendre.status()).toBe(200);
    const reactiver = await page.request.post(`${URL_API}/admin/utilisateurs/${dossier.id}/reactiver/`, {
      headers: bearer(jetonAdmin),
      data: {},
    });
    expect(reactiver.status()).toBe(200);

    // L'ingénieure lit la notification de validation : page liée + statut lu.
    await connexionUI(page, dossier.telephone);
    await expect(compteurVisible(page)).toHaveText('3');
    await page.goto('/notifications');
    await verifierAccessibilite(page);
    await page
      .locator('button[data-testid^="notification-"]')
      .filter({ hasText: 'Votre profil ingénieur est validé' })
      .first()
      .click();
    await expect(page).toHaveURL('/ingenieur');
    await expect(compteurVisible(page)).toHaveText('2');

    // « Tout marquer comme lu » : le compteur repart à zéro (vérifié à l'API).
    await page.goto('/notifications');
    await page.getByTestId('bouton-tout-lire').click();
    await expect(page.getByRole('status').filter({ hasText: 'marqué' })).toBeVisible();
    await expect(page.locator('[data-testid="compteur-notifications"]:visible')).toHaveCount(0);
    const compteur = await page.request.get(`${URL_API}/notifications/compteur/`, {
      headers: bearer(dossier.jeton),
    });
    expect((await compteur.json()).non_lues).toBe(0);
  });

  test('PW-F03-09 Jean passe « disponible » avec position : état conservé après rechargement', async ({
    page,
  }) => {
    await connexionUI(page, PERSONNAGES.jean.telephone);
    await page.goto('/livreur/disponibilite');
    await expect(page.getByTestId('page-disponibilite')).toBeVisible();
    await expect(page.getByTestId('etat-disponibilite')).toHaveAttribute('data-disponible', 'false');
    await verifierAccessibilite(page);

    // Nouvelle position (Douala) saisie via le sélecteur réutilisable.
    await page.getByLabel('Latitude').fill('4.0511');
    await page.getByLabel('Longitude').fill('9.7679');
    await page.getByTestId('champ-zone-livreur').fill('Douala');
    await page.getByTestId('bouton-basculer-disponibilite').click();
    await expect(page.getByTestId('etat-disponibilite')).toHaveAttribute('data-disponible', 'true');

    // Rechargement complet : l'état vient de l'API, pas de la mémoire UI.
    await page.reload();
    await expect(page.getByTestId('etat-disponibilite')).toHaveAttribute('data-disponible', 'true');

    // Vérification double côté API.
    const jeton = await connexionApiAvecJeton(page, PERSONNAGES.jean.telephone);
    const disponibilite = await page.request.get(`${URL_API}/livreurs/moi/disponibilite/`, {
      headers: bearer(jeton),
    });
    const json = await disponibilite.json();
    expect(json.disponible).toBe(true);
    expect(json.position.coordinates).toEqual([9.7679, 4.0511]);

    // Remise en état du compte de démonstration (indisponible).
    await page.getByTestId('bouton-basculer-disponibilite').click();
    await expect(page.getByTestId('etat-disponibilite')).toHaveAttribute('data-disponible', 'false');
  });
});
