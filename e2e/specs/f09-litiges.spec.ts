/**
 * E2E F-09 — Signalements, remboursements, évaluations
 * (docs/12-plan-tests-playwright.md §2, PW-F09-01 à 07).
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
const PHOTO_FIXTURE = 'e2e/fixtures/fichiers/photo-tomates.jpg';

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
    Array<{ id: string; libelle: string }> | { elements: Array<{ id: string; libelle: string }> };
  const liste = Array.isArray(corps) ? corps : corps.elements;
  const adresse = liste.find((a) => a.libelle === 'Domicile');
  expect(adresse, 'adresse Domicile requise (seed)').toBeDefined();
  return adresse!.id;
}

interface CommandePayee {
  commandeId: string;
  reference: string;
  totalFcfa: number;
  livraisonId: string;
  jetonPaul: string;
  jetonAmina: string;
  jetonJean: string;
}

/** Commande payée (vrai webhook NotchPay simulé) : livraison `proposee`. */
async function commandePayee(page: Page, suffixe: string): Promise<CommandePayee> {
  const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
  const exploitationId = await exploitationDePaul(page, jetonPaul);
  const nom = `Tomates Litige E2E-${suffixe}`;
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
  const commandeJson = (await commande.json()) as {
    id: string;
    reference: string;
    total_fcfa: number;
  };

  const acceptation = await page.request.post(`${URL_API}/commandes/${commandeJson.id}/accepter/`, {
    headers: bearer(jetonPaul),
  });
  expect(acceptation.ok()).toBeTruthy();

  const init = await page.request.post(`${URL_API}/commandes/${commandeJson.id}/paiements/`, {
    headers: {
      ...bearer(jetonAmina),
      'Content-Type': 'application/json',
      'Idempotency-Key': `e2e-f09-${suffixe}`,
    },
    data: { operateur: 'mtn_momo' },
  });
  expect(init.status()).toBe(201);
  const initJson = (await init.json()) as { reference_interne: string; montant_fcfa: number };

  const { envoyerWebhook, evenementReussi } = await import('../utils/notchpay');
  const webhook = await envoyerWebhook(
    page.request,
    evenementReussi(initJson.reference_interne, initJson.montant_fcfa, `f09-${suffixe}`)
  );
  expect(webhook.status()).toBe(200);

  const livraison = await page.request.get(`${URL_API}/commandes/${commandeJson.id}/livraison/`, {
    headers: bearer(jetonAmina),
  });
  expect(livraison.status()).toBe(200);
  const livraisonId = ((await livraison.json()) as { id: string }).id;

  const jetonJean = await connexionApiAvecJeton(page, PERSONNAGES.jean.telephone);
  return {
    commandeId: commandeJson.id,
    reference: commandeJson.reference,
    totalFcfa: commandeJson.total_fcfa,
    livraisonId,
    jetonPaul,
    jetonAmina,
    jetonJean,
  };
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

/** Commande payée conduite jusqu'à `livree` (Jean remet, code saisi via API). */
async function commandeLivree(page: Page, suffixe: string): Promise<CommandePayee> {
  const course = await commandePayee(page, suffixe);
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

  const codeReponse = await page.request.get(
    `${URL_API}/commandes/${course.commandeId}/code-remise/`,
    { headers: bearer(course.jetonAmina) }
  );
  expect(codeReponse.ok()).toBeTruthy();
  const code = ((await codeReponse.json()) as { code: string }).code;
  expect(code).toMatch(/^[0-9]{6}$/);

  const remise = await page.request.post(
    `${URL_API}/livraisons/${course.livraisonId}/confirmer-remise/`,
    {
      headers: { ...bearer(course.jetonJean), 'Content-Type': 'application/json' },
      data: { code },
    }
  );
  expect(remise.ok()).toBeTruthy();

  const detail = await page.request.get(`${URL_API}/commandes/${course.commandeId}/`, {
    headers: bearer(course.jetonAmina),
  });
  expect(((await detail.json()) as { statut: string }).statut).toBe('livree');
  return course;
}

/** La ligne visible de la file admin correspondant à cette commande. */
function ligneFileAdmin(page: Page, préfixe: string, reference: string) {
  return page
    .locator(`[data-testid^="lien-${préfixe}-"]:visible`)
    .filter({ hasText: reference })
    .first();
}

test.describe('F-09 — Signalements, remboursements, évaluations', () => {
  test.afterEach(async ({ page, clientApi }) => {
    // Base E2E partagée : horloge réelle et Jean remis indisponible (état seed).
    await clientApi.reinitialiserHorloge();
    const jetonJean = await connexionApiAvecJeton(page, PERSONNAGES.jean.telephone);
    await rendreDisponible(page, jetonJean, false);
  });

  test('PW-F09-01 @critique Amina signale, demande 2 000 FCFA, Mireille approuve et exécute, remboursée (E2E-10)', async ({
    page,
  }) => {
    // Scénario le plus long de la suite (course complète + litige + webhook +
    // exécution admin) : dépasse 30 s en emulation mobile, timeout relevé.
    test.slow();
    const course = await commandeLivree(page, suffixeUnique());

    // Amina : signalement avec photo puis demande de remboursement partiel.
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${course.commandeId}`);
    await expect(page.getByTestId('section-litige')).toBeVisible();
    await verifierAccessibilite(page);

    await page.getByTestId('bouton-signaler-probleme').click();
    const signalement = page.getByTestId('formulaire-signalement');
    await expect(signalement).toBeVisible();
    await signalement.getByTestId('champ-fichier').setInputFiles(PHOTO_FIXTURE);
    await page
      .getByTestId('champ-description-signalement')
      .fill('Trois kilos abîmés à la réception.');
    await page.getByTestId('bouton-envoyer-signalement').click();
    await expect(signalement).toHaveCount(0);

    await page.getByTestId('bouton-demander-remboursement').click();
    const formulaire = page.getByTestId('formulaire-remboursement');
    await expect(formulaire).toBeVisible();
    await formulaire.getByTestId('champ-fichier').setInputFiles(PHOTO_FIXTURE);
    await page.getByTestId('champ-montant-remboursement').fill('2000');
    await page.getByTestId('bouton-confirmer-remboursement').click();
    await expect(formulaire).toHaveCount(0);

    const mesDemandes = await page.request.get(`${URL_API}/remboursements/mes-demandes/`, {
      headers: bearer(course.jetonAmina),
    });
    expect(mesDemandes.ok()).toBeTruthy();
    const demandes = (await mesDemandes.json()) as Array<Record<string, unknown>>;
    const demande = demandes.find((d) => d.commande_reference === course.reference);
    expect(demande, 'la demande est passée à la plateforme').toBeDefined();
    expect(demande!.statut).toBe('demande');
    expect(demande!.montant_demande_fcfa).toBe(2000);

    // Mireille : examine, approuve 2 000 FCFA, saisit la référence du renvoi.
    const pageMireille = await nouvellePage(page.context());
    await connexionUI(pageMireille, PERSONNAGES.mireille.telephone);
    await pageMireille.goto('/admin/litiges');
    await expect(pageMireille.getByTestId('page-litiges-admin')).toBeVisible();
    await verifierAccessibilite(pageMireille);
    await ligneFileAdmin(pageMireille, 'remboursement', course.reference).click();
    const panneau = pageMireille.getByTestId('panneau-remboursement');
    await expect(panneau).toBeVisible();
    await panneau.getByTestId('bouton-examiner').click();
    await panneau.getByTestId('champ-montant-accorde').fill('2000');
    await panneau.getByTestId('bouton-approuver').click();
    await panneau.getByTestId('champ-reference').fill('MTN-99887766');
    await panneau.getByTestId('bouton-executer').click();
    await expect(panneau.getByTestId('dossier-reference')).toContainText('MTN-99887766');
    await expect(panneau).toContainText('Dossier clôturé');
    await pageMireille.context().close();

    // Double vérification API : remboursement effectué, commande remboursée.
    const detail = await page.request.get(`${URL_API}/commandes/${course.commandeId}/`, {
      headers: bearer(course.jetonAmina),
    });
    expect(((await detail.json()) as { statut: string }).statut).toBe('remboursee');

    // Amina voit « remboursée » sur son écran.
    await page.goto(`/commandes/${course.commandeId}`);
    await expect(page.getByTestId('page-detail-commande')).toContainText('Remboursée');
    await expect(page.getByTestId('suivi-remboursement')).toContainText('Commande remboursée.');
    await expect(page.getByTestId('remboursement-reference')).toContainText('MTN-99887766');
  });

  test('PW-F09-02 Demande après le délai de 48 h (horloge décalée) → refusée avec explication', async ({
    page,
    clientApi,
  }) => {
    const course = await commandeLivree(page, suffixeUnique());

    // Jeton émis AVANT le décalage (lecture réelle de l'expiration côté PyJWT).
    await clientApi.decalerHorloge(49 * 60);
    try {
      const demande = await page.request.post(`${URL_API}/remboursements/`, {
        headers: { ...bearer(course.jetonAmina), 'Content-Type': 'application/json' },
        data: {
          commande_id: course.commandeId,
          motif: 'autre',
          montant_demande_fcfa: 1000,
          justificatifs: [],
        },
      });
      expect(demande.status()).toBe(422);
      const corps = (await demande.json()) as { erreur: { code: string; message: string } };
      expect(corps.erreur.code).toBe('delai_depasse');
      expect(corps.erreur.message.length).toBeGreaterThan(0);
    } finally {
      await clientApi.reinitialiserHorloge();
    }
  });

  test('PW-F09-03 Montant demandé supérieur au paiement → refusé', async ({ page }) => {
    const course = await commandeLivree(page, suffixeUnique());
    const demande = await page.request.post(`${URL_API}/remboursements/`, {
      headers: { ...bearer(course.jetonAmina), 'Content-Type': 'application/json' },
      data: {
        commande_id: course.commandeId,
        motif: 'autre',
        montant_demande_fcfa: course.totalFcfa + 1000,
        justificatifs: [],
      },
    });
    expect(demande.status()).toBe(422);
    expect(((await demande.json()) as { erreur: { code: string } }).erreur.code).toBe(
      'montant_invalide'
    );

    // Écran : la demande reste possible avec un montant dans la limite.
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${course.commandeId}`);
    await page.getByTestId('bouton-demander-remboursement').click();
    const formulaire = page.getByTestId('formulaire-remboursement');
    await expect(formulaire).toBeVisible();
    await expect(formulaire).toContainText('48 h');
    await expect(formulaire).toContainText('FCFA');
  });

  test('PW-F09-04 Motif « endommagé » sans photo → bouton désactivé', async ({ page }) => {
    const course = await commandeLivree(page, suffixeUnique());
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${course.commandeId}`);
    await page.getByTestId('bouton-demander-remboursement').click();
    await page.getByTestId('champ-montant-remboursement').fill('2000');
    await expect(page.getByTestId('aide-justificatif-requis')).toBeVisible();
    await expect(page.getByTestId('bouton-confirmer-remboursement')).toBeDisabled();

    // La photo débloque l'envoi (garde-fou local ; la règle est vérifiée par l'API).
    await page
      .getByTestId('formulaire-remboursement')
      .getByTestId('champ-fichier')
      .setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByTestId('bouton-confirmer-remboursement')).toBeEnabled();
  });

  test('PW-F09-05 Évaluation impossible avant livraison, note 1–5 enregistrée une seule fois', async ({
    page,
  }) => {
    const course = await commandePayee(page, suffixeUnique());

    // Avant livraison : refus API (422 ValidationMetier) + aucune section d'évaluation.
    const avant = await page.request.post(`${URL_API}/commandes/${course.commandeId}/evaluation/`, {
      headers: { ...bearer(course.jetonAmina), 'Content-Type': 'application/json' },
      data: { note_agriculteur: 5 },
    });
    expect(avant.status()).toBe(422);
    expect(((await avant.json()) as { erreur: { code: string } }).erreur.code).toBe(
      'commande_non_livree'
    );
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${course.commandeId}`);
    await expect(page.getByTestId('formulaire-evaluation')).toHaveCount(0);

    // Après livraison : note enregistrée, visible en lecture seule, une seule fois.
    await rendreDisponible(page, course.jetonJean, true);
    const acceptation = await page.request.post(
      `${URL_API}/livraisons/${course.livraisonId}/accepter/`,
      { headers: bearer(course.jetonJean) }
    );
    expect(acceptation.ok()).toBeTruthy();
    await page.request.post(`${URL_API}/commandes/${course.commandeId}/preparer/`, {
      headers: bearer(course.jetonPaul),
    });
    await page.request.post(`${URL_API}/livraisons/${course.livraisonId}/demarrer/`, {
      headers: bearer(course.jetonJean),
    });
    const codeReponse = await page.request.get(
      `${URL_API}/commandes/${course.commandeId}/code-remise/`,
      { headers: bearer(course.jetonAmina) }
    );
    const code = ((await codeReponse.json()) as { code: string }).code;
    const remise = await page.request.post(
      `${URL_API}/livraisons/${course.livraisonId}/confirmer-remise/`,
      {
        headers: { ...bearer(course.jetonJean), 'Content-Type': 'application/json' },
        data: { code },
      }
    );
    expect(remise.ok()).toBeTruthy();

    await page.goto(`/commandes/${course.commandeId}`);
    await expect(page.getByTestId('formulaire-evaluation')).toBeVisible();
    await page
      .getByTestId('note-agriculteur')
      .getByRole('button', { name: /4 sur 5/ })
      .click();
    await page
      .getByTestId('note-livreur')
      .getByRole('button', { name: /5 sur 5/ })
      .click();
    await page.getByTestId('champ-commentaire-evaluation').fill('Panier de très bonne qualité.');
    await page.getByTestId('bouton-envoyer-evaluation').click();
    await expect(page.getByTestId('evaluation-deja-faite')).toBeVisible();
    await expect(page.getByTestId('evaluation-resume')).toContainText('4/5');

    const seconde = await page.request.post(
      `${URL_API}/commandes/${course.commandeId}/evaluation/`,
      {
        headers: { ...bearer(course.jetonAmina), 'Content-Type': 'application/json' },
        data: { note_agriculteur: 1 },
      }
    );
    expect(seconde.status()).toBe(409);
    expect(((await seconde.json()) as { erreur: { code: string } }).erreur.code).toBe(
      'evaluation_deja_faite'
    );
  });

  test('PW-F09-06 Annulation après paiement → remboursement intégral créé automatiquement dans la file de Mireille', async ({
    page,
  }) => {
    const course = await commandePayee(page, suffixeUnique());
    const annulation = await page.request.post(
      `${URL_API}/commandes/${course.commandeId}/annuler/`,
      { headers: bearer(course.jetonAmina) }
    );
    expect(annulation.ok()).toBeTruthy();

    // API : remboursement intégral (motif annulation) créé à examiner.
    const jetonMireille = await connexionApiAvecJeton(page, PERSONNAGES.mireille.telephone);
    const file = await page.request.get(`${URL_API}/admin/remboursements/`, {
      headers: bearer(jetonMireille),
    });
    expect(file.ok()).toBeTruthy();
    const dossiers = (await file.json()) as Array<Record<string, unknown>>;
    const dossier = dossiers.find((d) => d.commande_reference === course.reference);
    expect(dossier, 'le remboursement automatique est dans la file').toBeDefined();
    expect(dossier!.motif).toBe('annulation');
    expect(dossier!.montant_demande_fcfa).toBe(course.totalFcfa);
    expect(dossier!.statut).toBe('demande');

    // Écran : Mireille voit la ligne dans ADM-03.
    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await page.goto('/admin/litiges');
    await expect(page.getByTestId('file-remboursements')).toBeVisible();
    await expect(ligneFileAdmin(page, 'remboursement', course.reference)).toBeVisible();
    await ligneFileAdmin(page, 'remboursement', course.reference).click();
    await expect(page.getByTestId('panneau-remboursement')).toContainText('Annulation');
  });

  test('PW-F09-07 Refus du remboursement avec motif → Amina voit le motif', async ({ page }) => {
    const course = await commandeLivree(page, suffixeUnique());
    const demande = await page.request.post(`${URL_API}/remboursements/`, {
      headers: { ...bearer(course.jetonAmina), 'Content-Type': 'application/json' },
      data: {
        commande_id: course.commandeId,
        motif: 'autre',
        montant_demande_fcfa: 1000,
        justificatifs: [],
      },
    });
    expect(demande.status()).toBe(201);

    // Mireille refuse avec motif depuis ADM-03.
    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await page.goto('/admin/litiges');
    await ligneFileAdmin(page, 'remboursement', course.reference).click();
    const panneau = page.getByTestId('panneau-remboursement');
    await expect(panneau).toBeVisible();
    await panneau
      .getByTestId('champ-motif-refus-remboursement')
      .fill('Livraison conforme, photo non probante.');
    await panneau.getByTestId('bouton-refuser-remboursement').click();
    await expect(panneau.getByTestId('dossier-motif-decision')).toContainText(
      'Livraison conforme, photo non probante.'
    );

    // API : dossier refusé, motif conservé.
    const mesDemandes = await page.request.get(`${URL_API}/remboursements/mes-demandes/`, {
      headers: bearer(course.jetonAmina),
    });
    const remboursements = (await mesDemandes.json()) as Array<Record<string, unknown>>;
    const refund = remboursements.find((r) => r.commande_reference === course.reference);
    expect(refund!.statut).toBe('refuse');
    expect(refund!.motif_decision).toBe('Livraison conforme, photo non probante.');

    // Écran Amina : le motif de décision est affiché dans le suivi.
    const pageAmina = await nouvellePage(page.context());
    await connexionUI(pageAmina, PERSONNAGES.amina.telephone);
    await pageAmina.goto(`/commandes/${course.commandeId}`);
    await expect(pageAmina.getByTestId('suivi-remboursement')).toContainText(
      'Décision : Livraison conforme, photo non probante.'
    );
    await pageAmina.context().close();
  });
});
