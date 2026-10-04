/**
 * E2E F-13 — Chat temps réel et blocage (docs/12 §2, PW-F13-01 à 08).
 * Exécution **live obligatoire** : deux navigateurs (contextes séparés Paul /
 * Amina), backend servi par Daphne (`runserver` ASGI) qui expose `/ws`, MySQL
 * `agrisens_e2e`. Règles §1.4 : rôles/libellés d'abord, aucune attente fixe,
 * données uniques par test, identifiant dans chaque titre, double vérification
 * écran + API pour les règles critiques (idempotence, temps réel, permissions).
 */
import { expect, type Page, type BrowserContext } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { simulerHorsLigne, retablirEnLigne } from '../utils/reseau';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';
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

async function nouvellePage(contexteParent: BrowserContext): Promise<Page> {
  const navigateur = contexteParent.browser();
  const contexte = await navigateur!.newContext({
    baseURL: 'http://127.0.0.1:4173',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  });
  return contexte.newPage();
}

async function exploitationDe(page: Page, jeton: string): Promise<string> {
  const reponse = await page.request.get(`${URL_API}/exploitations/`, { headers: bearer(jeton) });
  expect(reponse.ok()).toBeTruthy();
  const liste = (await reponse.json()) as Array<{ id: string; nom: string }>;
  const champ = liste.find((e) => e.nom === 'Champ Nord') ?? liste[0];
  expect(champ, 'exploitation Paul requise (seed)').toBeDefined();
  return champ!.id;
}

async function creerProduitApi(page: Page, jeton: string, exploitationId: string): Promise<string> {
  const reponse = await page.request.post(`${URL_API}/produits/`, {
    headers: { ...bearer(jeton), 'Content-Type': 'application/json' },
    data: {
      nom: `Chat E2E-${suffixeUnique()}`,
      categorie: 'legumes',
      unite: 'kg',
      prix_unitaire_fcfa: 500,
      quantite_stock: '100',
      exploitation_id: exploitationId,
    },
  });
  expect(reponse.status(), 'création produit').toBe(201);
  return ((await reponse.json()) as { id: string }).id;
}

async function adresseDomicileAmina(page: Page, jeton: string): Promise<string> {
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

/** Commande Amina (acheteur) → Paul (agriculteur) : les deux parties du chat. */
async function commanderChezPaul(page: Page): Promise<string> {
  const jetonPaul = await connexionApiAvecJeton(page, PERSONNAGES.paul.telephone);
  const exploitationId = await exploitationDe(page, jetonPaul);
  const produitId = await creerProduitApi(page, jetonPaul, exploitationId);
  const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
  const adresseId = await adresseDomicileAmina(page, jetonAmina);
  const reponse = await page.request.post(`${URL_API}/commandes/`, {
    headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json' },
    data: { lignes: [{ produit_id: produitId, quantite: '10' }], adresse_id: adresseId },
  });
  expect(reponse.status(), 'création commande').toBe(201);
  return ((await reponse.json()) as { id: string }).id;
}

/** POST /conversations (partie de la relation) → id de conversation. */
async function creerConversationApi(
  page: Page,
  jeton: string,
  commandeId: string
): Promise<string> {
  const reponse = await page.request.post(`${URL_API}/conversations/`, {
    headers: { ...bearer(jeton), 'Content-Type': 'application/json' },
    data: { commande_id: commandeId },
  });
  expect(reponse.status(), 'ouverture conversation').toBe(201);
  return ((await reponse.json()) as { id: string }).id;
}

interface MessageApi {
  id: string;
  auteur: string;
  contenu: string | null;
}

async function listerMessagesApi(
  page: Page,
  jeton: string,
  conversationId: string
): Promise<MessageApi[]> {
  const reponse = await page.request.get(`${URL_API}/conversations/${conversationId}/messages/`, {
    headers: bearer(jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  return (await reponse.json()) as MessageApi[];
}

/** Envoi direct via l'API (id_client distinct) — sert à bâtir l'historique. */
async function envoyerMessageApi(
  page: Page,
  jeton: string,
  conversationId: string,
  contenu: string
): Promise<void> {
  const reponse = await page.request.post(`${URL_API}/conversations/${conversationId}/messages/`, {
    headers: { ...bearer(jeton), 'Content-Type': 'application/json' },
    data: { contenu, id_client: `${contenu}-${suffixeUnique()}` },
  });
  expect(reponse.ok(), `envoi API « ${contenu} »`).toBeTruthy();
}

async function attendreConnexionWs(page: Page): Promise<void> {
  await expect(page.getByTestId('indicateur-connexion')).toHaveText('En ligne', {
    timeout: 15_000,
  });
}

async function ecrireEtEnvoyer(page: Page, texte: string): Promise<void> {
  await page.getByTestId('champ-message').fill(texte);
  await page.getByTestId('bouton-envoyer-message').click();
}

test.describe('F-13 — Chat temps réel et blocage', () => {
  test('PW-F13-01 @critique Amina écrit à Paul depuis sa commande + photo ; Paul reçoit sans recharger ; accusé « Lu »', async ({
    page,
  }) => {
    const commandeId = await commanderChezPaul(page);

    // Amina : fiche commande (ACH-07) → « Contacter » → fil.
    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/commandes/${commandeId}`);
    await page.getByTestId('bouton-contacter').click();
    await expect(page).toHaveURL(/\/messages\/[^/]+$/);
    await attendreConnexionWs(page);

    const conversationId = page.url().split('/').pop()!;

    // Paul ouvre la même conversation dans un second navigateur (sans recharger ensuite).
    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(pagePaul);

    // Amina joint une photo puis envoie un texte unique.
    const texte = `Bonjour Paul, la commande ${suffixeUnique()} est prête ?`;
    await page.getByTestId('champ-fichier').setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByText('Fichier envoyé.')).toBeVisible({ timeout: 15_000 });
    await ecrireEtEnvoyer(page, texte);

    // Paul reçoit le message **sans rechargement** (signal WS → refetch HTTP).
    await expect(pagePaul.getByTestId('page-conversation-detail')).toContainText(texte, {
      timeout: 15_000,
    });

    // Paul a ouvert le fil → accusé de lecture renvoyé → Amina voit « Lu ».
    const messages = await listerMessagesApi(
      page,
      await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone),
      conversationId
    );
    const messageAmina = messages.find((m) => m.contenu === texte);
    expect(messageAmina, 'message d’Amina présent côté API').toBeDefined();
    await expect(page.getByTestId(`recu-lu-${messageAmina!.id}`)).toBeVisible({ timeout: 15_000 });

    await pagePaul.context().close();
  });

  test('PW-F13-02 Amina hors ligne → message « en attente » → renvoyé une seule fois au retour', async ({
    page,
  }) => {
    const commandeId = await commanderChezPaul(page);
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const conversationId = await creerConversationApi(page, jetonAmina, commandeId);

    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(pagePaul);

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(page);

    const texte = `File d’attente ${suffixeUnique()}`;
    await simulerHorsLigne(page); // navigator.onLine = false
    await ecrireEtEnvoyer(page, texte);

    // Le message part en file locale (aucun doublon serveur à ce stade).
    await expect(page.getByTestId('message-en-attente')).toBeVisible();

    await retablirEnLigne(page);

    // Renvoyé une seule fois : Paul le reçoit, l'API n'en contient qu'un.
    await expect(pagePaul.getByTestId('page-conversation-detail')).toContainText(texte, {
      timeout: 20_000,
    });
    const messages = await listerMessagesApi(page, jetonAmina, conversationId);
    const occurrences = messages.filter((m) => m.contenu === texte);
    expect(occurrences.length, 'pas de doublon après renvoi').toBe(1);

    await pagePaul.context().close();
  });

  test('PW-F13-03 Paul bloque Amina → plus d’écriture possible ; déblocage → renoue', async ({
    page,
  }) => {
    const commandeId = await commanderChezPaul(page);
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const conversationId = await creerConversationApi(page, jetonAmina, commandeId);

    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(pagePaul);

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(page);

    // Paul bloque Amina.
    await pagePaul.getByTestId('bouton-bloquer').click();
    await expect(pagePaul.getByTestId('bouton-debloquer')).toBeVisible();

    // Amina tente d'écrire → 403 explicatif, avertissement de blocage.
    const texteBloque = `Test blocage ${suffixeUnique()}`;
    await ecrireEtEnvoyer(page, texteBloque);
    await expect(page.getByTestId('avertissement-blocage')).toBeVisible();
    // Côté API aussi : l'envoi est refusé, rien n'est stocké.
    const refus = await page.request.post(`${URL_API}/conversations/${conversationId}/messages/`, {
      headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json' },
      data: { contenu: texteBloque, id_client: `refus-${suffixeUnique()}` },
    });
    expect(refus.status(), 'envoi bloqué → 403').toBe(403);

    // Paul débloque ; Amina recharge (état local) et renoue.
    await pagePaul.getByTestId('bouton-debloquer').click();
    await expect(pagePaul.getByTestId('bouton-bloquer')).toBeVisible();

    await page.reload();
    await attendreConnexionWs(page);
    const texteLibre = `Après déblocage ${suffixeUnique()}`;
    await ecrireEtEnvoyer(page, texteLibre);
    await expect(pagePaul.getByTestId('page-conversation-detail')).toContainText(texteLibre, {
      timeout: 15_000,
    });

    await pagePaul.context().close();
  });

  test('PW-F13-04 Message <script> rendu en texte, aucune boîte de dialogue', async ({ page }) => {
    const commandeId = await commanderChezPaul(page);
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const conversationId = await creerConversationApi(page, jetonAmina, commandeId);

    const dialogues: string[] = [];
    page.on('dialog', (d) => {
      dialogues.push(d.message());
      void d.dismiss();
    });

    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(pagePaul);

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(page);

    const charge = `<script>alert(${suffixeUnique()})</script>`;
    await ecrireEtEnvoyer(page, charge);

    // Le texte brut est affiché tel quel côté émetteur et récepteur.
    await expect(page.getByText(charge, { exact: false })).toBeVisible();
    await expect(pagePaul.getByTestId('page-conversation-detail')).toContainText(charge, {
      timeout: 15_000,
    });
    // Aucune exécution : pas de boîte de dialogue alert().
    expect(dialogues, 'aucun script exécuté').toHaveLength(0);

    await pagePaul.context().close();
  });

  test('PW-F13-05 Historique long → chargement des anciens au clic, sans doublon', async ({
    page,
  }) => {
    const commandeId = await commanderChezPaul(page);
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const conversationId = await creerConversationApi(page, jetonAmina, commandeId);

    // 60 messages (fenêtre initiale = 50) pour exercer le curseur `avant`.
    for (let i = 0; i < 60; i += 1) {
      await envoyerMessageApi(page, jetonAmina, conversationId, `msg-${i}`);
    }

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(page);

    const bulles = page.locator('[data-testid^="message-"]');
    await expect(bulles).toHaveCount(50);

    // Charger les plus anciens amène le reste, sans créer de doublon.
    await page.getByTestId('bouton-charger-anciens').click();
    await expect(bulles).toHaveCount(60);
    await expect(page.getByText('msg-0', { exact: true })).toBeVisible();
    // « msg-1 » n'apparaît qu'une fois (déduplication par id).
    await expect(page.getByText('msg-1', { exact: true })).toHaveCount(1);
  });

  test('PW-F13-06 Signalement d’un message → visible dans la file de Mireille', async ({
    page,
  }) => {
    const commandeId = await commanderChezPaul(page);
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const conversationId = await creerConversationApi(page, jetonAmina, commandeId);

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(page);

    const texteSignale = `Contenu à signaler ${suffixeUnique()}`;
    await ecrireEtEnvoyer(page, texteSignale);

    // Paul signale le message d'Amina (la bulle de l'autre partie porte « Signaler »).
    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto(`/messages/${conversationId}`);
    await attendreConnexionWs(pagePaul);
    await expect(pagePaul.getByText(texteSignale)).toBeVisible({ timeout: 15_000 });

    // Le testid du bouton porte l'id du message signalé (cible du signalement).
    const boutonSignaler = pagePaul.locator('[data-testid^="bouton-signaler-"]').first();
    const testidBouton = await boutonSignaler.getAttribute('data-testid');
    const idMessageSignale = testidBouton!.replace('bouton-signaler-', '');
    await boutonSignaler.click();
    await pagePaul.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
    await expect(pagePaul.getByText('Message signalé à la modération.')).toBeVisible();
    await pagePaul.context().close();

    // Mireille retrouve le signalement dans sa file. On le cible par son id
    // (recherché côté API) puis on ouvre le panneau : la colonne « motif »
    // n'est pas rendue sur la vue mobile, le panneau l'est sur tous les écrans.
    const jetonMireille = await connexionApiAvecJeton(page, PERSONNAGES.mireille.telephone);
    const repSignalements = await page.request.get(`${URL_API}/admin/signalements/`, {
      headers: bearer(jetonMireille),
    });
    expect(repSignalements.ok(), 'file admin signalements').toBeTruthy();
    const signalements = (await repSignalements.json()) as Array<{
      id: string;
      cible_type: string;
      cible_id: string;
      motif: string;
    }>;
    const signalement = signalements.find((s) => s.cible_id === idMessageSignale);
    expect(signalement, 'signalement du message présent côté admin').toBeDefined();

    const pageMireille = await nouvellePage(page.context());
    await connexionUI(pageMireille, PERSONNAGES.mireille.telephone);
    await pageMireille.goto('/admin/litiges');
    await expect(pageMireille.getByTestId('page-litiges-admin')).toBeVisible();
    await pageMireille.getByTestId('onglet-signalements').click();
    await expect(pageMireille.getByTestId('file-signalements')).toBeVisible();
    await pageMireille
      .locator(`[data-testid="lien-signalement-${signalement!.id}"]:visible`)
      .first()
      .click();
    const panneau = pageMireille.getByTestId('panneau-signalement');
    await expect(panneau).toBeVisible();
    await expect(panneau.getByText(/Contenu abusif/i)).toBeVisible();
    await pageMireille.context().close();
  });

  test('PW-F13-07 Un utilisateur sans lien ne peut pas ouvrir la conversation (404)', async ({
    page,
  }) => {
    const commandeId = await commanderChezPaul(page);
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const conversationId = await creerConversationApi(page, jetonAmina, commandeId);

    // Jean (livreur) n'est partie ni de la commande ni de la conversation.
    const jetonJean = await connexionApiAvecJeton(page, PERSONNAGES.jean.telephone);
    const lecture = await page.request.get(`${URL_API}/conversations/${conversationId}/`, {
      headers: bearer(jetonJean),
    });
    expect(lecture.status(), 'conversation privée → 404').toBe(404);

    await connexionUI(page, PERSONNAGES.jean.telephone);
    await page.goto(`/messages/${conversationId}`);
    await expect(page.getByTestId('etat-erreur').first()).toBeVisible();
  });

  test('PW-F13-08 Mobile : liste puis conversation empilée, retour à la liste', async ({
    page,
  }) => {
    const commandeId = await commanderChezPaul(page);
    const jetonAmina = await connexionApiAvecJeton(page, PERSONNAGES.amina.telephone);
    const conversationId = await creerConversationApi(page, jetonAmina, commandeId);
    await envoyerMessageApi(page, jetonAmina, conversationId, `Salut ${suffixeUnique()}`);

    await connexionUI(page, PERSONNAGES.amina.telephone);
    await page.goto('/messages');
    await expect(page.getByTestId('page-conversations')).toBeVisible();
    await page.getByTestId(`conversation-${conversationId}`).click();
    await expect(page).toHaveURL(new RegExp(`/messages/${conversationId}$`));
    await expect(page.getByTestId('page-conversation-detail')).toBeVisible();

    await page.getByTestId('bouton-retour-liste').click();
    await expect(page).toHaveURL('/messages');
    await expect(page.getByTestId('page-conversations')).toBeVisible();
  });
});
